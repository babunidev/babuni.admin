/** Fixed SQL only. No caller-provided SQL, identifiers, predicates or mutation queries. */
async function readTransaction(client,query,params=[]) {
  await client.query('BEGIN READ ONLY')
  try {
    await client.query("SET LOCAL statement_timeout = '3000ms'")
    const result=await client.query(query,params)
    await client.query('COMMIT')
    return result.rows
  }catch(error) {
    try {await client.query('ROLLBACK')}catch{}
    throw error
  }
}

// Checks role attributes and player-table grants before permitting any record view.
// This is additional protection; the remote DBA must provision a separate least-privileged role.
export async function verifyReadonlyRole(client) {
  const rows=await readTransaction(client,`
    SELECT current_database() AS database_name, current_user AS role_name,
      r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication AS elevated,
      has_table_privilege(current_user,'public.players','SELECT') AS can_read,
      has_table_privilege(current_user,'public.players','INSERT,UPDATE,DELETE,TRUNCATE') AS can_write
    FROM pg_roles r WHERE r.rolname=current_user
  `)
  const role=rows[0]
  if(!role||role.elevated||!role.can_read||role.can_write)throw Error('DB_ROLE_NOT_READ_ONLY')
  return {database:role.database_name,readOnly:true,roleVerified:true}
}
export async function readDatabaseHealth(client) {
  const rows=await readTransaction(client,`
    SELECT current_database() AS database_name,
      current_setting('transaction_read_only') AS read_only, now() AS server_time
  `)
  if(rows[0]?.read_only!=='on')throw Error('READ_ONLY_TRANSACTION_REQUIRED')
  return {ok:true,database:rows[0].database_name,readOnly:true,
    checkedAt:new Date().toISOString()}
}
export async function readPlayerPreview(client) {
  const rows=await readTransaction(client,`
    SELECT id::text AS id,
      left(coalesce(data->>'playerName',''),100) AS name
    FROM public.players ORDER BY id LIMIT 25
  `)
  return rows.map(row=>({id:String(row.id),name:String(row.name??'')}))
}
