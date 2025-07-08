import { RouteRecordRaw } from 'vue-router';
import RouteNames from './names';
import massaConnectDApp from '../massa-connect-dapp.vue';

const routes = Object.assign({}, RouteNames);
routes.massaConnectDApp.component = massaConnectDApp;

export default (namespace: string): RouteRecordRaw[] => {
  return Object.values(routes).map(route => {
    route.path = `/${namespace}/${route.path}`;
    route.name = `${namespace}-${String(route.name)}`;
    return route;
  });
}; 