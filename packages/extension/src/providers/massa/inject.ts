import EventEmitter from 'eventemitter3';
import {
  ProviderInterface,
  ProviderName,
  ProviderType,
  ProviderOptions,
  SendMessageHandler,
} from '@/types/provider';
import { EnkryptWindow } from '@/types/globals';
import { InjectedProvider, MassaAccount, MassaTransaction } from './types';
import { SettingsType } from '@/libs/settings-state/types';
import { InternalMethods } from '@/types/messenger';

export class Provider extends EventEmitter implements ProviderInterface, InjectedProvider {
  name: ProviderName;
  type: ProviderType;
  version = __VERSION__;
  connected = false;
  sendMessageHandler: SendMessageHandler;

  constructor(options: ProviderOptions) {
    super();
    this.name = options.name;
    this.type = options.type;
    this.sendMessageHandler = options.sendMessageHandler;
  }

  async request(request: any): Promise<any> {
    console.log('🟡 [PROVIDER] Making request:', request);
    console.log('🟡 [PROVIDER] sendMessageHandler:', this.sendMessageHandler);
    console.log('🟡 [PROVIDER] provider name:', this.name);
    
    try {
      const requestString = JSON.stringify(request);
      console.log('🟡 [PROVIDER] Request string:', requestString);
      
      const res = await this.sendMessageHandler(
        this.name,
        requestString
      );
      console.log('🟡 [PROVIDER] Request response:', res);
      return res;
    } catch (error) {
      console.error('❌ [PROVIDER] Request error:', error);
      throw error;
    }
  }

  async connect(): Promise<MassaAccount[]> {
    console.log('🟡 [PROVIDER] Connect method called');
    try {
      const accounts = await this.request({
        method: 'massa_connect',
      });
      console.log('🟡 [PROVIDER] Connect response:', accounts);
      this.connected = true;
      return accounts;
    } catch (error) {
      console.error('❌ [PROVIDER] Connect error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.request({
      method: 'massa_disconnect',
    });
    this.connected = false;
  }

  async signTransaction(transaction: MassaTransaction): Promise<string> {
    return this.request({
      method: 'massa_signTransaction',
      params: [transaction],
    });
  }

  async signMessage(message: string): Promise<string> {
    return this.request({
      method: 'massa_signMessage',
      params: [message],
    });
  }

  async sendTransaction(transaction: {
    from: string;
    to: string;
    amount: string;
    fee?: string;
    data?: string;
    validityStartPeriod?: number;
  }): Promise<{ operationId: string; status: string; hash: string }> {
    console.log('🟡 [PROVIDER] sendTransaction called with:', transaction);
    const request = {
      method: 'massa_sendTransaction',
      params: [transaction],
    };
    console.log('🟡 [PROVIDER] sendTransaction request:', request);
    return this.request(request);
  }

  async sendRawTransaction(signedTransaction: any): Promise<string> {
    console.log('🟡 [PROVIDER] sendRawTransaction called with:', signedTransaction);
    const request = {
      method: 'massa_sendRawTransaction',
      params: [signedTransaction],
    };
    console.log('🟡 [PROVIDER] sendRawTransaction request:', request);
    return this.request(request);
  }

  async getAccounts(): Promise<string[]> {
    return this.request({
      method: 'massa_getAccounts',
    });
  }

  async getBalance(address: string): Promise<string> {
    return this.request({
      method: 'massa_getBalance',
      params: [address],
    });
  }

  async getNetwork(): Promise<string> {
    return this.request({
      method: 'massa_getNetwork',
    });
  }

  async setNetwork(networkName: string): Promise<{ success: boolean; network: string }> {
    return this.request({
      method: 'massa_setNetwork',
      params: [networkName],
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  handleMessage(msg: string): void {
    const { method, params } = JSON.parse(msg);
    this.emit(method, params);
  }
}

const ProxyHandler = {
  proxymethods: ['request', 'connect', 'disconnect', 'signTransaction', 'signMessage', 'sendTransaction', 'sendRawTransaction', 'getAccounts', 'getBalance', 'getNetwork', 'setNetwork'],
  ownKeys(target: Provider) {
    return Object.keys(target).concat(this.proxymethods);
  },
  set(target: Provider, name: keyof Provider, value: any) {
    if (!this.ownKeys(target).includes(name)) this.proxymethods.push(name);
    return Reflect.set(target, name, value);
  },
  getOwnPropertyDescriptor(target: Provider, name: keyof Provider) {
    return {
      value: this.get(target, name),
      configurable: true,
      writable: false,
      enumerable: true,
    };
  },
  get(target: Provider, prop: keyof Provider) {
    if (typeof target[prop] === 'function') {
      return (target[prop] as () => any).bind(target);
    }
    return target[prop];
  },
  has(target: Provider, name: keyof Provider) {
    return this.ownKeys(target).includes(name);
  },
};

const injectDocument = (
  document: EnkryptWindow | Window,
  options: ProviderOptions,
): void => {
  console.log('🟡 [INJECT] Creating Massa provider with options:', options);
  const provider = new Provider(options);
  console.log('🟡 [INJECT] Provider created:', provider);
  
  const proxiedProvider = new Proxy(provider, ProxyHandler);
  console.log('🟡 [INJECT] Proxied provider created:', proxiedProvider);

  // Always add to enkrypt.providers first
  (document as any)['enkrypt']['providers'][options.name] = provider;
  console.log('🟡 [INJECT] Added to enkrypt.providers');

  options
    .sendMessageHandler(
      ProviderName.enkrypt,
      JSON.stringify({ method: InternalMethods.getSettings, params: [] }),
    )
    .then((settings: SettingsType) => {
      console.log('🟡 [INJECT] Settings received:', settings);
      // For now, always inject the massa provider since there's no massa settings type yet
      // In the future, add massa to SettingsType and check settings.massa?.inject
      console.log('🟡 [INJECT] Injecting massa provider into document as window.massa');
      document['massa'] = proxiedProvider;
      console.log('🟡 [INJECT] Massa provider injected successfully');
    })
    .catch((error) => {
      console.error('❌ [INJECT] Error getting settings:', error);
      // Inject anyway for testing
      console.log('🟡 [INJECT] Injecting massa provider anyway (fallback)');
      document['massa'] = proxiedProvider;
    });
};

export default injectDocument; 