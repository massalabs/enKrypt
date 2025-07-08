import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface } from '@/types/provider';
import massa_requestAccounts from './massa_requestAccounts';
import massa_connect from './massa_connect';
import massa_disconnect from './massa_disconnect';
import massa_getAccounts from './massa_getAccounts';
import massa_getBalance from './massa_getBalance';
import massa_getNetwork from './massa_getNetwork';
import massa_setNetwork from './massa_setNetwork';
import massa_sendTransaction from './massa_sendTransaction';

export default (provider: BackgroundProviderInterface): MiddlewareFunction[] => {
  return [
    massa_requestAccounts,
    massa_connect,
    massa_disconnect,
    massa_getAccounts,
    massa_getBalance,
    massa_getNetwork,
    massa_setNetwork,
    massa_sendTransaction,
    async (request, response, next) => {
      // Add any additional Massa-specific middleware logic here
      return next();
    },
  ];
}; 