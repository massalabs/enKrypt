import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { CallbackFunction } from '@enkryptcom/types';
import { getCustomError } from '@/libs/error';
import openOnboard from '@/libs/utils/open-onboard';
import { SignerType } from '@enkryptcom/types';
import { NetworkNames } from '@enkryptcom/types';
import { getNetworkByName } from '@/libs/utils/networks';
import { getAccountsByNetworkName } from '@/libs/utils/accounts';
import { fromBase } from '@enkryptcom/utils';
import DomainState from '@/libs/domain-state';
import PublicKeyRing from '@/libs/keyring/public-keyring';
import { WindowPromise } from '@/libs/window-promise';
import AccountState from '../libs/accounts-state';
import { throttle } from 'lodash';

let isAccountAccessPending = false;
let accountAccessTimeout: NodeJS.Timeout | null = null;
const throttledOpenOnboard = throttle(() => openOnboard(), 10000);
const pendingPromises: Array<{
  payload: ProviderRPCRequest;
  res: CallbackFunction;
}> = [];

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_requestAccounts') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_requestAccounts called with payload:', payload);
    
    if (isAccountAccessPending) {
      console.log('🔵 [BACKGROUND] Account access already pending, adding to queue');
      pendingPromises.push({
        payload,
        res,
      });
      return;
    }

    isAccountAccessPending = true;
    console.log('🔵 [BACKGROUND] isAccountAccessPending:', isAccountAccessPending);
    console.log('🔵 [BACKGROUND] pendingPromises.length:', pendingPromises.length);

    const handleRemainingPromises = () => {
      isAccountAccessPending = false;
      if (accountAccessTimeout) {
        clearTimeout(accountAccessTimeout);
        accountAccessTimeout = null;
      }

      if (pendingPromises.length) {
        const promi = pendingPromises.pop();
        if (promi) handleAccountAccess(promi.payload, promi.res);
      }
    };

    const getAccounts = async () => {
      const domainState = new DomainState();
      const publicKeyring = new PublicKeyRing();

      const selectedAddressPromise = domainState.getSelectedAddress();
      const selectedNetworkPromise = domainState.getSelectedNetWork();
      const accountsPromise = publicKeyring.getAccounts([SignerType.ed25519mas]);

      return Promise.all([
        selectedAddressPromise,
        selectedNetworkPromise,
        accountsPromise,
      ]).then(async ([selectedAddress, selectedNetwork, accounts]) => {
        console.log('🔵 [BACKGROUND] Step 4: Account data retrieved successfully');
        console.log('🔵 [BACKGROUND] - selectedAddress:', selectedAddress);
        console.log('🔵 [BACKGROUND] - selectedNetwork:', selectedNetwork);
        console.log('🔵 [BACKGROUND] - accounts count:', accounts.length);
        console.log('🔵 [BACKGROUND] - accounts:', accounts);
        
        const selectedNetworkName = Object.values(NetworkNames).find(
          n => n === selectedNetwork,
        );
        console.log('🔵 [BACKGROUND] - selectedNetworkName:', selectedNetworkName);
        
        // If no account is selected, use the first available account
        const account = accounts.find(acc => acc.address === selectedAddress) || accounts[0];
        console.log('🔵 [BACKGROUND] - selected account:', account);

        console.log('🔵 [BACKGROUND] Step 5: Getting network...');
        const network = await getNetworkByName(selectedNetworkName || NetworkNames.Massa);
        console.log('🔵 [BACKGROUND] - network:', network?.name);

        const accountData = {
          selectedNetwork: network,
          selectedAccountAddress: account?.address || '',
          accounts: accounts.map(acc => {
            return {
              address: acc.address,
              publicKey: acc.publicKey,
              name: acc.name,
              type: acc.signerType,
            };
          }),
        };
        
        console.log('🔵 [BACKGROUND] - accountData prepared:', accountData);
        return accountData;
      });
    };

    const handleAccountAccess = async (
      _payload: ProviderRPCRequest,
      _res: CallbackFunction,
    ) => {
      console.log('🔵 [BACKGROUND] === Starting handleAccountAccess ===');
      console.log('🔵 [BACKGROUND] Handling account access with payload:', _payload);
      console.log('🔵 [BACKGROUND] Payload options:', _payload.options);
      
      // Use domain from options or fallback to localhost
      const domain = _payload.options?.domain || 'localhost';
      console.log('🔵 [BACKGROUND] Using domain:', domain);

      try {
        console.log('🔵 [BACKGROUND] Step 1: Checking if KeyRing is initialized...');
        console.log('🔵 [BACKGROUND] Provider KeyRing check:', !!this.KeyRing);
        const isInitialized = await this.KeyRing.isInitialized();
        console.log('🔵 [BACKGROUND] KeyRing initialized:', isInitialized);
        
        if (!isInitialized) {
          console.log('❌ [BACKGROUND] Enkrypt not initialized, opening onboard');
          _res(getCustomError('Enkrypt not initialized'));
          throttledOpenOnboard();
          return handleRemainingPromises();
        }
        
        console.log('🔵 [BACKGROUND] Step 2: Creating domain and keyring instances...');
        const domainState = new DomainState();
        const publicKeyring = new PublicKeyRing();
        console.log('✅ [BACKGROUND] Instances created successfully');

        console.log('🔵 [BACKGROUND] Step 3: Getting account data...');
        const selectedAddressPromise = domainState.getSelectedAddress();
        const selectedNetworkPromise = domainState.getSelectedNetWork();
        const accountsPromise = publicKeyring.getAccounts([SignerType.ed25519mas]);

        Promise.all([
          selectedAddressPromise,
          selectedNetworkPromise,
          accountsPromise,
        ]).then(async ([selectedAddress, selectedNetwork, accounts]) => {
          console.log('🔵 [BACKGROUND] Step 4: Account data retrieved successfully');
          console.log('🔵 [BACKGROUND] - selectedAddress:', selectedAddress);
          console.log('🔵 [BACKGROUND] - selectedNetwork:', selectedNetwork);
          console.log('🔵 [BACKGROUND] - accounts count:', accounts.length);
          console.log('🔵 [BACKGROUND] - accounts:', accounts);
          
          const selectedNetworkName = Object.values(NetworkNames).find(
            n => n === selectedNetwork,
          );
          console.log('🔵 [BACKGROUND] - selectedNetworkName:', selectedNetworkName);
          
          // If no account is selected, use the first available account
          const account = accounts.find(acc => acc.address === selectedAddress) || accounts[0];
          console.log('🔵 [BACKGROUND] - selected account:', account);

          console.log('🔵 [BACKGROUND] Step 5: Getting network...');
          const network = await getNetworkByName(selectedNetworkName || NetworkNames.Massa);
          console.log('🔵 [BACKGROUND] - network:', network?.name);

          const accountData = {
            selectedNetwork: network,
            selectedAccountAddress: account?.address || '',
            accounts: accounts.map(acc => {
              return {
                address: acc.address,
                publicKey: acc.publicKey,
                name: acc.name,
                type: acc.signerType,
              };
            }),
          };
          
          console.log('🔵 [BACKGROUND] - accountData prepared:', accountData);
          
          // Check if domain is approved
          const accountsState = new AccountState();
          const isApproved = await accountsState.isApproved(domain);
          console.log('🔵 [BACKGROUND] Domain approved:', isApproved);
          
          if (isApproved) {
            // Domain is approved, return accounts directly
            console.log('🔵 [BACKGROUND] Domain approved, returning accounts directly');
            const massaAccount = {
              address: accountData.selectedAccountAddress,
              balance: '0', // Will be fetched later
              activeRolls: 0,
              candidateRolls: 0,
            };
            _res(null, [massaAccount]);
            handleRemainingPromises();
          } else {
            // Domain not approved, open connection UI
            console.log('🔵 [BACKGROUND] Domain not approved, opening connection UI');
            const windowPromise = new WindowPromise();
            windowPromise
              .getResponse(
                this.getUIPath(this.UIRoutes.massaConnectDApp.path),
                JSON.stringify({
                  ..._payload,
                  params: [network?.name || NetworkNames.Massa],
                }),
              )
              .then(({ error, result }) => {
                if (error) {
                  console.error('❌ [BACKGROUND] Connection UI error:', error);
                  _res(error);
                } else {
                  console.log('✅ [BACKGROUND] Connection successful, result:', result);
                  const accounts = JSON.parse(result || '[]');
                  _res(null, accounts);
                }
              })
              .catch((error) => {
                console.error('❌ [BACKGROUND] Connection UI exception:', error);
                _res(getCustomError('User rejected the request'));
              })
              .finally(handleRemainingPromises);
          }
        }).catch((error) => {
          console.error('❌ [BACKGROUND] Error in account data retrieval:', error);
          console.error('❌ [BACKGROUND] Error stack:', error.stack);
          _res(getCustomError('User rejected the request'));
          handleRemainingPromises();
        });
      } catch (error) {
        console.error('❌ [BACKGROUND] Unexpected error in handleAccountAccess:', error);
        console.error('❌ [BACKGROUND] Error stack:', error.stack);
        _res(getCustomError('User rejected the request'));
        handleRemainingPromises();
      }
    };

    handleAccountAccess(payload, res);
  }
};

export default method; 