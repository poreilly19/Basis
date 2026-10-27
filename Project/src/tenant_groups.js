/* BEGIN BASIS TENANT GROUPS */
// Classification metadata only. Reading an older model never migrates it.
function basisTenantGroupIds(tenant){
  const values=Array.isArray(tenant.groups)?tenant.groups:tenant.group?[tenant.group]:[];
  return [...new Set(values.filter(id=>typeof id==='string'&&id.length>0))];
}
function basisSetTenantGroups(tenant,ids){
  if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string'||!id||id.length>1000))
    throw Error('Tenant groups must be an array of at most 1000 nonempty group IDs.');
  const groups=[...new Set(ids)];
  tenant.groups=groups;
  tenant.group=groups[0]||''; // Primary membership for older readers.
  return groups;
}
function basisTenantGroupMembers(model,id){
  return (model.tenants||[]).filter(tenant=>basisTenantGroupIds(tenant).includes(id));
}
function basisRemoveTenantGroup(model,id){
  for(const tenant of model.tenants||[]){
    const ids=basisTenantGroupIds(tenant);
    if(ids.includes(id))basisSetTenantGroups(tenant,ids.filter(value=>value!==id));
    else if(tenant.group===id)tenant.group=ids[0]||'';
  }
  model.tgroups=(model.tgroups||[]).filter(group=>group.id!==id);
}
// Validate the entire batch before touching any live tenant. Other memberships
// (including unresolved imported IDs) survive both add and remove operations.
function basisBulkTenantGroups(model,tenantIds,groupId,operation){
  if(!['add','remove'].includes(operation)||!Array.isArray(tenantIds)||!tenantIds.length||new Set(tenantIds).size!==tenantIds.length)
    throw Error('Select tenants and an Add or Remove operation.');
  if(!(model.tgroups||[]).some(group=>group.id===groupId))throw Error('The selected group no longer exists.');
  const changes=tenantIds.map(id=>{
    const matches=(model.tenants||[]).filter(tenant=>tenant.id===id);
    if(matches.length!==1)throw Error('A selected tenant changed. Select the tenants again.');
    const tenant=matches[0],before=basisTenantGroupIds(tenant);
    const after=operation==='add'?[...new Set([...before,groupId])]:before.filter(value=>value!==groupId);
    basisSetTenantGroups({},after); // Enforce the same limits without partial writes.
    return {tenant,before,after};
  });
  let changed=0;
  for(const {tenant,before,after} of changes)if(JSON.stringify(before)!==JSON.stringify(after)){basisSetTenantGroups(tenant,after);changed++;}
  return changed;
}
/* END BASIS TENANT GROUPS */
