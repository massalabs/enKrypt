import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { getCustomError } from '@/libs/error';
import { WindowPromise } from '@/libs/window-promise';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_signTransaction') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_signTransaction called with payload:', payload);
    
    if (!payload.params || payload.params.length < 1) {
      console.error('❌ [BACKGROUND] Invalid request - not enough params');
      return res(
        getCustomError(
          'massa_signTransaction: invalid request not enough params',
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

    console.log('🔵 [BACKGROUND] Transaction params for signing:', txParams);

    if (!txParams.from || !txParams.to || !txParams.amount) {
      console.error('❌ [BACKGROUND] Missing required parameters');
      return res(
        getCustomError(
          'massa_signTransaction: missing required parameters (from, to, amount)',
        ),
      );
    }

    try {
      // Get account from keyring using the "from" parameter (like Ethereum does)
      const account = await this.KeyRing.getAccount(txParams.from.toLowerCase());
      if (!account) {
        console.error('❌ [BACKGROUND] Account not found for address:', txParams.from);
        return res(
          getCustomError(
            'massa_signTransaction: account not found',
          ),
        );
      }

      console.log('🔵 [BACKGROUND] Found account:', account.address);

      // Create a window promise and send transaction params to UI (like Ethereum does)
      const windowPromise = new WindowPromise();
      windowPromise
        .getResponse(
          this.getUIPath(this.UIRoutes.massaSignTransaction.path),
          JSON.stringify({
            ...payload,
            params: [txParams, account, this.getCurrentNetwork()?.name],
          }),
          true,
        )
        .then(({ error, result }) => {
          if (error) return res(error);
          res(null, JSON.parse(result as string));
        });
      
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_signTransaction:', error);
      res(getCustomError(`Transaction signing failed: ${(error as Error).message || 'Unknown error'}`));
    }
  }
};

export default method; 