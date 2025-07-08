import { BaseNetwork } from '@/types/base-network';
import getRequestProvider, { RequestClass } from '@enkryptcom/request';
import { MiddlewareFunction, OnMessageResponse } from '@enkryptcom/types';
import Middlewares from './methods';
import EventEmitter from 'eventemitter3';
import {
  BackgroundProviderInterface,
  ProviderName,
  ProviderRPCRequest,
} from '@/types/provider';
import GetUIPath from '@/libs/utils/get-ui-path';
import PublicKeyRing from '@/libs/keyring/public-keyring';
import UIRoutes from './ui/routes/names';
import { RoutesType } from '@/types/ui';
import massaNetworks from './networks';
import { NetworkNames } from '@enkryptcom/types';

export default class MassaProvider
  extends EventEmitter
  implements BackgroundProviderInterface
{
  private network: BaseNetwork;
  requestProvider: RequestClass;
  middlewares: MiddlewareFunction[] = [];
  namespace: string;
  KeyRing: PublicKeyRing;
  UIRoutes: RoutesType;
  toWindow: (message: string) => void;

  constructor(toWindow: (message: string) => void, network: BaseNetwork = massaNetworks[NetworkNames.Massa],) {
    super();
    console.log('🔵 [MASSA_PROVIDER] Constructor called with network:', network.name);
    this.network = network;
    this.toWindow = toWindow;
    this.setMiddleWares();
    this.requestProvider = getRequestProvider('', this.middlewares);
    this.requestProvider.on('notification', (notif: any) => {
      this.sendNotification(JSON.stringify(notif));
    });
    this.namespace = ProviderName.massa;
    this.KeyRing = new PublicKeyRing();

    this.UIRoutes = UIRoutes;
    console.log('🔵 [MASSA_PROVIDER] Constructor completed, middlewares:', this.middlewares.length);
  }

  private setMiddleWares(): void {
    this.middlewares = Middlewares(this).map(mw => mw.bind(this));
    console.log('🔵 [MASSA_PROVIDER] Middlewares set:', this.middlewares.length);
  }

  setRequestProvider(network: BaseNetwork): void {
    const prevURL = new URL(this.network.node);
    const newURL = new URL(network.node);
    this.network = network;
    if (prevURL.protocol === newURL.protocol)
      this.requestProvider.changeNetwork(network.node);
    else
      this.requestProvider = getRequestProvider(network.node, this.middlewares);
  }

  async isPersistentEvent(): Promise<boolean> {
    return false;
  }

  async sendNotification(notif: string): Promise<void> {
    return this.toWindow(notif);
  }

  request(request: ProviderRPCRequest): Promise<OnMessageResponse> {
    console.log('🔵 [MASSA_PROVIDER] Request initiated:', request.method);
    return this.requestProvider
      .request(request)
      .then(res => {
        console.log('🔵 [MASSA_PROVIDER] Request successful:', request.method);
        return {
          result: JSON.stringify(res),
        };
      })
      .catch(e => {
        console.error('🔴 [MASSA_PROVIDER] Request failed:', request.method, e.message);
        return {
          error: JSON.stringify(e.message),
        };
      });
  }

  getUIPath(page: string): string {
    return GetUIPath(page, this.namespace);
  }

  getCurrentNetwork(): BaseNetwork {
    return this.network;
  }
}
