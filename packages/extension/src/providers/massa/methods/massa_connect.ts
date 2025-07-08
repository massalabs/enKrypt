import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { CallbackFunction } from '@enkryptcom/types';
import { getCustomError } from '@/libs/error';
import massa_requestAccounts from './massa_requestAccounts';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  console.log('🔵 [BACKGROUND] massa_connect called with payload:', payload);

  if (payload.method !== 'massa_connect') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_connect called with payload:', payload);
    
    try {
      // Create a new payload for requestAccounts
      const requestAccountsPayload = {
        ...payload,
        method: 'massa_requestAccounts'
      };
      
      console.log('🔵 [BACKGROUND] Calling massa_requestAccounts with payload:', requestAccountsPayload);
      
      // Call massa_requestAccounts and handle the response
      massa_requestAccounts.call(this, requestAccountsPayload, (error, result) => {
        console.log('🔵 [BACKGROUND] massa_requestAccounts response:', { error, result });
        
        if (error) {
          console.error('❌ [BACKGROUND] massa_requestAccounts returned error:', error);
          res(error);
        } else {
          console.log('✅ [BACKGROUND] massa_requestAccounts returned success:', result);
          // Return the accounts array directly
          res(null, result);
        }
      }, next);
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_connect:', error);
      res(getCustomError(`Connection failed: ${error.message}`));
    }
  }
};

export default method; 