import { api, APP } from './asc.mjs';

const vers = await api('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS&fields[appStoreVersions]=versionString,appStoreState,releaseType,build&include=build&fields[builds]=version`);
for (const v of vers.data) {
  const build = (vers.included || []).find((b) => b.id === v.relationships?.build?.data?.id);
  console.log('version', v.attributes.versionString, v.attributes.appStoreState, v.attributes.releaseType, 'build', build ? build.attributes.version : '-');
}
const subs = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP}&fields[reviewSubmissions]=state,submittedDate&limit=5`);
for (const s of subs.data) console.log('submission', s.attributes.state, s.attributes.submittedDate);
