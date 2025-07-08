import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { CallbackFunction } from '@enkryptcom/types';
import { NetworkNames } from '@enkryptcom/types';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_getNetwork') return next();
  else {
    try {
      console.log('🔵 [BACKGROUND] massa_getNetwork called');
      
      // Get the current network from the provider
      if (this.getCurrentNetwork) {
        const currentNetwork = this.getCurrentNetwork();
        console.log('🔵 [BACKGROUND] Current network from provider:', currentNetwork.name);
        res(null, currentNetwork.name);
      } else {
        console.log('🔵 [BACKGROUND] getCurrentNetwork method not available, using default');
        res(null, NetworkNames.Massa);
      }
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_getNetwork:', error);
      res(null, NetworkNames.Massa);
    }
  }
};

export default method; 