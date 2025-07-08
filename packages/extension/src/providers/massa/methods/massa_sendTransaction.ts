import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { getCustomError } from '@/libs/error';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_sendTransaction') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_sendTransaction called with payload:', payload);
    
    if (!payload.params || payload.params.length < 1) {
      console.error('❌ [BACKGROUND] Invalid request - not enough params');
      return res(
        getCustomError(
          'massa_sendTransaction: invalid request not enough params',
        ),
      );
    }

    const txParams = payload.params[0] as {
      from: string;
      to: string;
      amount: string;
      fee?: string;
      data?: string;
      validityStartPeriod?: number;
    };

    console.log('🔵 [BACKGROUND] Transaction params:', txParams);

    if (!txParams.from || !txParams.to || !txParams.amount) {
      console.error('❌ [BACKGROUND] Missing required parameters');
      return res(
        getCustomError(
          'massa_sendTransaction: missing required parameters (from, to, amount)',
        ),
      );
    }

    try {
      console.log('🔵 [BACKGROUND] Step 1: Signing transaction...');
      
      // First, sign the transaction using massa_signTransaction
      const signTransactionPromise = new Promise((resolve, reject) => {
        this.request({
          method: 'massa_signTransaction',
          params: [txParams],
          options: payload.options,
        }).then((signResponse) => {
          if (signResponse.error) {
            console.error('❌ [BACKGROUND] Signing failed:', signResponse.error);
            reject(signResponse.error);
          } else {
            console.log('✅ [BACKGROUND] Signing successful:', signResponse.result);
            resolve(signResponse.result);
          }
        }).catch(reject);
      });

      const signedTransaction = await signTransactionPromise;
      
      console.log('🔵 [BACKGROUND] Step 2: Broadcasting signed transaction...');
      
      // Then, broadcast the signed transaction using massa_sendRawTransaction
      const broadcastTransactionPromise = new Promise((resolve, reject) => {
        this.request({
          method: 'massa_sendRawTransaction',
          params: [signedTransaction],
          options: payload.options,
        }).then((broadcastResponse) => {
          if (broadcastResponse.error) {
            console.error('❌ [BACKGROUND] Broadcasting failed:', broadcastResponse.error);
            reject(broadcastResponse.error);
          } else {
            console.log('✅ [BACKGROUND] Broadcasting successful:', broadcastResponse.result);
            resolve(broadcastResponse.result);
          }
        }).catch(reject);
      });

      const operationId = await broadcastTransactionPromise;
      
      console.log('✅ [BACKGROUND] Complete transaction flow successful, operation ID:', operationId);
      
      // Return the operation ID
      res(null, operationId);
      
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_sendTransaction:', error);
      res(error as any);
    }
  }
};

export default method; 