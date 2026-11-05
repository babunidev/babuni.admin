import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,statSync,existsSync,rmSync,chmodSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const helper=resolve('scripts/ssh-agent-login.py')
const python=process.env.PYTHON||'python3'

function fixture() {
  const root=mkdtempSync(join(tmpdir(),'babuni-ssh-login-'))
  const configHome=join(root,'.config')
  const configDir=join(configHome,'babuni-admin')
  const key=join(root,'identity')
  const fakeBin=join(root,'bin')
  mkdirSync(configDir,{recursive:true,mode:0o700})
  mkdirSync(fakeBin,{mode:0o700})
  writeFileSync(key,'synthetic-private-key-not-valid',{mode:0o600})
  writeFileSync(key+'.pub','ssh-ed25519 synthetic fixture\n',{mode:0o644})
  writeFileSync(join(configDir,'morkahja-probe.json'),JSON.stringify({
    enabled:true,sshIdentityFile:key,
  })+'\n',{mode:0o600})
  // Neither ssh-keygen nor ssh-add in this fixture can contact a network.
  writeFileSync(join(fakeBin,'ssh-keygen'),[
    '#!/bin/sh',
    'printf "%s\\n" "256 SHA256:TestKeyABCDE fixture (ED25519)"',
    '',
  ].join('\n'),{mode:0o700})
  writeFileSync(join(fakeBin,'ssh-add'),[
    '#!/bin/sh',
    'if [ "$1" = "-l" ]; then',
    '  if [ -f "$HOME/agent-added" ]; then',
    '    printf "%s\\n" "256 SHA256:TestKeyABCDE fixture (ED25519)"',
    '    exit 0',
    '  fi',
    '  exit 1',
    'fi',
    'printf "%s" "$SSH_ASKPASS_REQUIRE|$SSH_ASKPASS" > "$HOME/askpass-policy"',
    'touch "$HOME/agent-added"',
    'exit 0',
    '',
  ].join('\n'),{mode:0o700})
  const askpass=join(root,'fake-askpass')
  writeFileSync(askpass,'#!/bin/sh\nexit 0\n',{mode:0o700})
  return {
    root,key,askpass,configHome,
    env:{...process.env,HOME:root,XDG_CONFIG_HOME:configHome,
      PATH:fakeBin+':'+process.env.PATH,SSH_AUTH_SOCK:join(root,'ssh-agent.sock'),
      SSH_ASKPASS:askpass,DISPLAY:':77'},
  }
}
function run(env,action) {
  return spawnSync(python,[helper,action],{
    encoding:'utf8',env,timeout:8000,
  })
}

test('installer creates a removable, owner-only XDG login entry without copying key material',()=>{
  const f=fixture()
  try{
    const first=run(f.env,'install')
    assert.equal(first.status,0,first.stderr)
    assert.match(first.stdout,/SSH_LOGIN_AUTOSTART_INSTALLED/)
    const entry=join(f.configHome,'autostart','babuni-admin-ssh-agent.desktop')
    const installed=join(f.root,'.local','share','babuni-admin','ssh-agent-login.py')
    assert.ok(existsSync(entry))
    assert.ok(existsSync(installed))
    assert.equal(statSync(entry).mode&0o077,0)
    assert.equal(statSync(installed).mode&0o077,0)
    const body=readFileSync(entry,'utf8')
    assert.match(body,/^Exec="[^"]+" "[^"]+" run$/m)
    assert.match(body,/^X-BabuniAdmin-Managed=true$/m)
    assert.ok(!body.includes(f.key))
    assert.ok(!body.includes('synthetic-private-key'))
    const again=run(f.env,'install')
    assert.equal(again.status,0,again.stderr)
    const uninstalled=run(f.env,'uninstall')
    assert.equal(uninstalled.status,0,uninstalled.stderr)
    assert.equal(existsSync(entry),false)
    assert.equal(existsSync(installed),false)
    assert.ok(existsSync(f.key))
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('login adds only approved identity and skips duplicate reloads',()=>{
  const f=fixture()
  try {
    let result=run(f.env,'status')
    assert.equal(result.status,1)
    assert.match(result.stdout,/SSH_LOGIN_IDENTITY_NOT_LOADED/)
    result=run(f.env,'run')
    assert.equal(result.status,0,result.stderr)
    assert.equal(result.stdout,'')
    const policy=readFileSync(join(f.root,'askpass-policy'),'utf8')
    assert.equal(policy,'force|'+f.askpass)
    assert.equal(existsSync(join(f.root,'agent-added')),true)
    result=run(f.env,'status')
    assert.equal(result.status,0,result.stderr)
    assert.match(result.stdout,/SSH_LOGIN_IDENTITY_READY/)
    rmSync(join(f.root,'askpass-policy'))
    result=run(f.env,'run')
    assert.equal(result.status,0)
    assert.equal(existsSync(join(f.root,'askpass-policy')),false)
  } finally {rmSync(f.root,{recursive:true,force:true})}
})

test('login fails closed without graphical session or safe private config',()=>{
  const f=fixture()
  try {
    const env={...f.env}
    delete env.DISPLAY
    delete env.WAYLAND_DISPLAY
    const noGui=run(env,'run')
    assert.equal(noGui.status,1)
    assert.equal(existsSync(join(f.root,'agent-added')),false)
    const config=join(f.configHome,'babuni-admin','morkahja-probe.json')
    chmodSync(config,0o644)
    const unsafe=run(f.env,'status')
    assert.equal(unsafe.status,1)
    assert.match(unsafe.stdout,/SSH_LOGIN_PRIVATE_CONFIG_UNAVAILABLE/)
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('installer never overwrites other startup entries',()=>{
  const f=fixture()
  try {
    const entryDir=join(f.configHome,'autostart')
    mkdirSync(entryDir,{recursive:true})
    const entry=join(entryDir,'babuni-admin-ssh-agent.desktop')
    writeFileSync(entry,'[Desktop Entry]\nName=Another application\n')
    const blocked=run(f.env,'install')
    assert.equal(blocked.status,1)
    assert.match(blocked.stdout,/SSH_LOGIN_EXISTING_AUTOSTART_UNMANAGED/)
    assert.match(readFileSync(entry,'utf8'),/Another application/)
  }finally{rmSync(f.root,{recursive:true,force:true})}
})
