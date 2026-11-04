#!/usr/bin/env node
import { LocalConnectionRegistry } from '../vite/localConnectionRegistry.ts'
import { saveMorkahjaConfig } from '../local-service/morkahjaConfig.mjs'

// Configures NON-SECRET metadata only. SSH authentication uses the user's SSH agent or a
// verified private identity file. The DB password stays in the Linux Secret Service.
const [id,sshUser,databaseUser,databaseName,identityFile]=process.argv.slice(2)
if(!id||!sshUser||!databaseUser||!databaseName) {
  console.error('Usage: npm run morkahja:configure -- <profile-uuid> <ssh-user> <db-user> <db-name> [~/.ssh/identity-file]')
  process.exit(2)
}
try{
  const profile=new LocalConnectionRegistry().list().find(p=>p.id===id)
  if(!profile||profile.projectId!=='morkahja'||profile.kind!=='postgres-ssh')throw Error('UNSUPPORTED_PROFILE')
  const config={sshUser,databaseUser,databaseName}
  if(identityFile)config.identityFile=identityFile
  saveMorkahjaConfig(profile,config)
  console.log('Non-secret Morkahja connection settings saved privately for profile',id)
  console.log('SSH host verification requires a pre-trusted host key in ~/.ssh/known_hosts.')
  console.log('The database password must be stored separately with: npm run credentials -- set '+id)
  console.log('No connection attempted.')
}catch(error){
  console.error('Configuration rejected:',error?.message||'INVALID_DB_CONFIG')
  process.exitCode=1
}
