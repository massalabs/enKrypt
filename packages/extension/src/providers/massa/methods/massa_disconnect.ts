import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { getCustomError } from '@/libs/error';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_disconnect') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_disconnect called');
    
    try {
      // For now, just return success
      // In a real implementation, you might want to clear any stored state
      console.log('✅ [BACKGROUND] Massa disconnected successfully');
      res(null, true);
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_disconnect:', error);
      res(getCustomError(`Disconnection failed: ${error.message}`));
    }
  }
};

export default method; 