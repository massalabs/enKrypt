import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { CallbackFunction } from '@enkryptcom/types';
import { NetworkNames } from '@enkryptcom/types';

const isValidMassaAddress = (address: string): boolean => {
  // Simple validation: Massa addresses start with 'AU' and are 50+ chars
  return typeof address === 'string' && address.startsWith('AU') && address.length >= 50;
};

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_getBalance') return next();
  else {
    try {
      console.log('🔵 [BACKGROUND] massa_getBalance called with payload:', payload);
      
      const address = payload.params?.[0];
      if (!address || !isValidMassaAddress(address)) {
        console.error('❌ [BACKGROUND] Invalid address:', address);
        res(new Error('Please enter a valid Massa address'), null);
        return;
      }

      console.log('🔵 [BACKGROUND] Getting balance for address:', address);

      // Get the current network from the provider
      if (!this.getCurrentNetwork) {
        console.error('❌ [BACKGROUND] getCurrentNetwork method not available');
        res(new Error('Could not determine current network'), null);
        return;
      }

      const currentNetwork = this.getCurrentNetwork();
      console.log('🔵 [BACKGROUND] Using current network:', currentNetwork.name);

      // Get the API from the current network
      const api = await currentNetwork.api();
      console.log('🔵 [BACKGROUND] API obtained from network');

      let balance = '0';
      try {
        balance = await api.getBalance(address);
        if (typeof balance !== 'string') balance = String(balance);
        console.log('🔵 [BACKGROUND] Balance fetched successfully:', balance);
      } catch (apiError) {
        console.error('❌ [BACKGROUND] Error fetching balance from API:', apiError);
        res(new Error('Could not fetch balance from network'), null);
        return;
      }
      
      console.log('✅ [BACKGROUND] massa_getBalance returning balance:', balance);
      res(null, balance);
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_getBalance:', error);
      res(error, null);
    }
  }
};

export default method; 