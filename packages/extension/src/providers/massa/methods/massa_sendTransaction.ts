import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { getCustomError } from '@/libs/error';
import { WindowPromise } from '@/libs/window-promise';
import { getNetworkByName } from '@/libs/utils/networks';
import { NetworkNames } from '@enkryptcom/types';
import { JsonRpcProvider, Account, OperationOptions } from '@massalabs/massa-web3';

// Test function that can be called from browser console
export const testMassaSendTransaction = async (provider: any) => {
  console.log('🧪 [TEST] Testing massa_sendTransaction...');
  
  const testParams = {
    from: 'AU1uMaKuKzRkQPGGTmZdahhDaQKt8YwZgJcJjXaFMjQjr1XgA9R', // Replace with actual address
    to: 'AU1uMaKuKzRkQPGGTmZdahhDaQKt8YwZgJcJjXaFMjQjr1XgA9R', // Replace with actual address
    amount: '1000000000', // 1 MAS in base units
    fee: '10000000', // 0.01 MAS in base units
  };
  
  try {
    const result = await provider.sendTransaction(testParams);
    console.log('🧪 [TEST] Transaction result:', result);
    return result;
  } catch (error) {
    console.error('🧪 [TEST] Transaction error:', error);
    throw error;
  }
};

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
      console.log('🔵 [BACKGROUND] Getting account for address:', txParams.from);
      
      // Get the account to sign the transaction
      const account = await this.KeyRing.getAccount(txParams.from)
      if (!account) {
        console.error('❌ [BACKGROUND] Account not found for address:', txParams.from);
        return res(
          getCustomError(
            'massa_sendTransaction: account not found',
          ),
        );
      }

      console.log('🔵 [BACKGROUND] Account found:', account);

      // Get the current network from the provider
      if (!this.getCurrentNetwork) {
        console.error('❌ [BACKGROUND] getCurrentNetwork method not available');
        return res(getCustomError('Could not determine current network'));
      }
      
      const network = this.getCurrentNetwork();
      console.log('🔵 [BACKGROUND] Using current network:', network.name);
      
      // Fetch the account balance
      const api = await network?.api();
      const balance = await api?.getBalance(account.address);
      console.log('🔵 [BACKGROUND] Account balance:', balance);
      
      // Create account object with balance information
      const accountWithBalance = {
        ...account,
        balance: balance, // Balance in base units
      };
      
      // Create transaction options - convert BigInt to string for JSON serialization
      const options = {
        fee: txParams.fee ? txParams.fee : undefined, // Keep as string for JSON serialization
      };

      console.log('🔵 [BACKGROUND] Opening UI window with params:', {
        txParams,
        accountWithBalance,
        network,
        options
      });

      // Create a window promise for user confirmation
      const windowPromise = new WindowPromise();
      windowPromise
        .getResponse(
          this.getUIPath(this.UIRoutes.massaSendTransaction.path),
          JSON.stringify({
            ...payload,
            params: [txParams, accountWithBalance, network, options],
          }),
          true,
        )
        .then(async ({ error, result }) => {
          console.log('🔵 [BACKGROUND] Received response from UI:', { error, result });
          
          if (error) {
            console.error('❌ [BACKGROUND] UI returned error:', error);
            return res(error);
          }
          
          console.log('✅ [BACKGROUND] UI returned success result:', result);
          
          // Parse the result to get transaction parameters
          try {
            const parsedResult = JSON.parse(result as string);
            console.log('🔵 [BACKGROUND] Parsed result:', parsedResult);
            
            // Here you would typically sign and send the transaction
            // For now, we'll just return the result
            res(null, result as string);
          } catch (parseError) {
            console.error('❌ [BACKGROUND] Error parsing result:', parseError);
            res(getCustomError('Invalid response format from UI'));
          }
        })
        .catch((error) => {
          console.error('❌ [BACKGROUND] Error in massa_sendTransaction:', error);
          res(getCustomError('User rejected transaction'));
        });
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_sendTransaction:', error);
      res(getCustomError(`Transaction failed: ${error.message}`));
    }
  }
};

export default method; 