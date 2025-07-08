import { MiddlewareFunction } from '@enkryptcom/types';
import { BackgroundProviderInterface, ProviderRPCRequest } from '@/types/provider';
import { CallbackFunction } from '@enkryptcom/types';
import { SignerType } from '@enkryptcom/types';
import PublicKeyRing from '@/libs/keyring/public-keyring';
import { getNetworkByName } from '@/libs/utils/networks';
import { NetworkNames } from '@enkryptcom/types';
import AccountState from '../libs/accounts-state';

const method: MiddlewareFunction = async function (
  this: BackgroundProviderInterface,
  payload: ProviderRPCRequest,
  res,
  next,
): Promise<void> {
  if (payload.method !== 'massa_getAccounts') return next();
  else {
    console.log('🔵 [BACKGROUND] massa_getAccounts called with payload:', payload);
    
    try {
      // Check if domain is provided
      if (!payload.options?.domain) {
        console.log('🔵 [BACKGROUND] No domain provided for massa_getAccounts, using localhost for testing');
        
        // For testing purposes, if no domain is provided, return all accounts
        // In production, this should be handled differently
        const publicKeyring = new PublicKeyRing();
        const allAccounts = await publicKeyring.getAccounts([SignerType.ed25519mas]);
        console.log('🔵 [BACKGROUND] All Massa accounts (no domain):', allAccounts);
        
        const accountAddresses = allAccounts.map(acc => acc.address);
        console.log('✅ [BACKGROUND] massa_getAccounts returning all accounts:', accountAddresses);
        res(null, accountAddresses);
        return;
      }

      console.log('🔵 [BACKGROUND] Checking domain approval for:', payload.options.domain);
      
      // Check if domain is approved
      const accountState = new AccountState();
      const approvedAddresses = await accountState.getApprovedAddresses(payload.options.domain);
      
      console.log('🔵 [BACKGROUND] Approved addresses for domain:', approvedAddresses);
      
      if (approvedAddresses.length === 0) {
        console.log('🔵 [BACKGROUND] No approved addresses for domain, returning empty array');
        res(null, []);
        return;
      }

      // Get all Massa accounts
      const publicKeyring = new PublicKeyRing();
      const allAccounts = await publicKeyring.getAccounts([SignerType.ed25519mas]);
      console.log('🔵 [BACKGROUND] All Massa accounts:', allAccounts);
      
      // Filter to only approved addresses
      const approvedAccounts = allAccounts.filter(acc => 
        approvedAddresses.includes(acc.address)
      );
      
      console.log('🔵 [BACKGROUND] Approved accounts:', approvedAccounts);
      
      // Return just the addresses (like other providers)
      const accountAddresses = approvedAccounts.map(acc => acc.address);
      
      console.log('✅ [BACKGROUND] massa_getAccounts returning:', accountAddresses);
      res(null, accountAddresses);
      
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in massa_getAccounts:', error);
      res(null, []);
    }
  }
};

export default method; 