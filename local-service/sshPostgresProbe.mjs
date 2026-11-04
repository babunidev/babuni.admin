import { readMorkahjaProbeConfig } from './remoteProbeConfig.mjs'
import { startSshTunnel } from './sshTunnel.mjs'
import { readCredentialForService } from './keyring.mjs'

const checked = () => new Date().toISOString()
const status = (code,detail,ok=false) => ({
  state:ok?'disconnected':'not-configured',code,detail,checkedAt:checked(),
  ...(ok?{lastSuccessAt:checked()}:{}),
})
let inFlight=false
export const isSshProbeActive=()=>inFlight

// Queries metadata and effective write privileges only. No player records are read.
// The current transaction is explicitly READ ONLY regardless of the server role.
export async function inspectReadOnlyDatabase(config,localPort,password) {
  const { default:pg } = await import('pg')
  const client=new pg.Client({
    host:'127.0.0.1',port:localPort, user:config.dbUser,database:config.dbName,
    password,ssl:false,connectionTimeoutMillis:4500,
    query_timeout:3500,statement_timeout:3000,
    application_name:'babuni-admin-read-only-health',
    options:'-c default_transaction_read_only=on',
  })
  const sql=[
    'SELECT current_user AS role_name, current_database() AS db_name,',
    ' NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls) AS safe_role,',
    " NOT has_database_privilege(current_user,current_database(),'CREATE') AS no_db_create,",
    ' NOT EXISTS (',
    ' SELECT 1 FROM pg_namespace n',
    " WHERE n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg_%'",
    " AND has_schema_privilege(current_user,n.oid,'CREATE')",
    ' ) AS no_schema_create,',
    ' NOT EXISTS (',
    ' SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
    " WHERE n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg_%'",
    " AND c.relkind IN ('r','p')",
    " AND has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')",
    ' ) AS no_table_write',
    ' FROM pg_roles r WHERE r.rolname=current_user',
  ].join('\n')
  try {
    await client.connect()
    await client.query('BEGIN READ ONLY')
    const response=await client.query(sql)
    await client.query('ROLLBACK')
    const row=response.rows[0]
    if(!row || row.role_name!==config.dbUser || row.db_name!==config.dbName ||
        !row.safe_role || !row.no_db_create || !row.no_schema_create || !row.no_table_write) {
      return {ok:false,code:'DB_ROLE_NOT_READ_ONLY'}
    }
    return {ok:true}
  } finally {
    try { await client.end() } catch { /* cleanup only */ }
  }
}

// A manually triggered check, not a persistent connection or general SQL API.
export async function probeMorkahjaPostgres(profile, deps={}) {
  if(inFlight)return status('REMOTE_PROBE_BUSY','A read-only remote probe is already in progress.')
  inFlight=true
  let tunnel
  try {
    const configResult=await (deps.readConfig||readMorkahjaProbeConfig)(profile)
    if(!configResult.ok) return status(configResult.code,'Remote probe is disabled or its private configuration is not trusted.')
    const config=configResult.config
    const password=await (deps.getPassword||readCredentialForService)(profile)
    tunnel=await (deps.openTunnel||startSshTunnel)(config)
    const probe=await (deps.inspectDatabase||inspectReadOnlyDatabase)(config,tunnel.port,password)
    if(!probe.ok)return status(probe.code,'Remote database role did not satisfy the read-only requirements.')
    return status('REMOTE_DB_HEALTHY_READ_ONLY',
      'Authenticated SSH and read-only database privilege probe succeeded; tunnel closed after the test.',true)
  }catch(error) {
    const code=typeof error?.message==='string' &&
      ['KEYRING_LOCKED','KEYRING_UNAVAILABLE','KEYRING_UNKNOWN','KEYRING_CREDENTIAL_MISSING',
       'SSH_SESSION_FAILED','SSH_FORWARD_TIMEOUT'].includes(error.message)
      ? error.message:'REMOTE_PROBE_FAILED'
    return status(code,'Remote probe did not complete. No remote edits were attempted.')
  }finally {
    try { await tunnel?.stop() }catch { /* closing an ephemeral tunnel is best effort */ }
    inFlight=false
  }
}
