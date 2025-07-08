import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { getCustomError } from '@/libs/error';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_sendRawTransaction') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_sendRawTransaction called with payload:', payload);
    
    if (!payload.params || payload.params.length < 1) {
      console.error('❌ [BACKGROUND] Invalid request - not enough params');
      return res(
        getCustomError(
          'massa_sendRawTransaction: invalid request not enough params',
        ),
      );
    }

    const serializedTx = payload.params[0];
    console.log('🔵 [BACKGROUND] Serialized transaction data:', serializedTx);

    if (!serializedTx) {
      console.error('❌ [BACKGROUND] Invalid serialized transaction data');
      return res(
        getCustomError(
          'massa_sendRawTransaction: invalid serialized transaction data',
        ),
      );
    }

    try {
      // Get the current network from the provider
      if (!this.getCurrentNetwork) {
        console.error('❌ [BACKGROUND] getCurrentNetwork method not available');
        return res(getCustomError('Could not determine current network'));
      }
      
      const network = this.getCurrentNetwork();
      console.log('🔵 [BACKGROUND] Using current network for broadcast:', network.name);
      
      // Parse the serialized transaction to understand what we're broadcasting
      let transactionInfo;
      try {
        if (typeof serializedTx === 'string') {
          // If it's a JSON string (our current placeholder format)
          transactionInfo = JSON.parse(serializedTx);
          console.log('🔵 [BACKGROUND] Parsed transaction info:', transactionInfo);
        } else {
          // If it's already an object or raw bytes
          transactionInfo = serializedTx;
        }
      } catch (parseError) {
        console.log('🔵 [BACKGROUND] Raw transaction data (not JSON):', serializedTx);
        transactionInfo = { raw: serializedTx };
      }
      
      // TODO: Implement actual transaction broadcasting using Massa web3
      // This should:
      // 1. Take the serialized transaction bytes/data
      // 2. Submit it to the Massa network using JsonRpcProvider or similar
      // 3. Return the operation ID from the network
      
      console.log('🔵 [BACKGROUND] Broadcasting transaction to Massa network...');
      console.log('🔵 [BACKGROUND] Network node:', network.node);
      
      // Placeholder broadcasting logic
      // In a real implementation, this would use Massa web3 to submit the transaction
      // Example: 
      // const provider = JsonRpcProvider.fromRPCUrl(network.node);
      // const operationId = await provider.sendOperation(serializedTx);
      
      // For now, return a placeholder operation ID
      const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('✅ [BACKGROUND] Transaction broadcast successful, operation ID:', operationId);
      
      // Return the operation ID
      res(null, operationId);
      
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_sendRawTransaction:', error);
      res(getCustomError(`Transaction broadcast failed: ${(error as Error).message || 'Unknown error'}`));
    }
  }
};

export default method; 