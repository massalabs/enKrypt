import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { CallbackFunction } from '@enkryptcom/types';
import { getCustomError } from '@/libs/error';
import { NetworkNames } from '@enkryptcom/types';
import massaNetworks from '../networks';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_setNetwork') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_setNetwork called with payload:', payload);
    
    try {
      const networkName = payload.params?.[0];
      
      if (!networkName) {
        console.error('❌ [BACKGROUND] No network name provided');
        res(getCustomError('Network name is required'));
        return;
      }
      
      console.log('🔵 [BACKGROUND] Setting network to:', networkName);
      
      // Check if the network exists
      const availableNetworks = Object.keys(massaNetworks);
      console.log('🔵 [BACKGROUND] Available networks:', availableNetworks);
      
      if (!availableNetworks.includes(networkName)) {
        console.error('❌ [BACKGROUND] Invalid network name:', networkName);
        res(getCustomError(`Invalid network name. Available networks: ${availableNetworks.join(', ')}`));
        return;
      }
      
      // Get the network object
      const network = massaNetworks[networkName];
      console.log('🔵 [BACKGROUND] Network object:', network.name);
      
      // Set the network in the provider
      if (this.setRequestProvider) {
        this.setRequestProvider(network);
        console.log('✅ [BACKGROUND] Network set successfully to:', network.name);
        res(null, { success: true, network: network.name });
      } else {
        console.error('❌ [BACKGROUND] setRequestProvider method not available');
        res(getCustomError('Network switching not supported'));
      }
      
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_setNetwork:', error);
      res(getCustomError(`Failed to set network: ${error.message}`));
    }
  }
};

export default method; 