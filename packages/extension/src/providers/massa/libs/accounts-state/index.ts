import { EnkryptAccount } from '@enkryptcom/types';
import { getAccountsByNetworkName } from '@/libs/utils/accounts';
import { NetworkNames } from '@enkryptcom/types';

class AccountState {
  private storageKey = 'massa_domain_approvals';

  private async getStorage(): Promise<Record<string, string[]>> {
    try {
      const storage = await browser.storage.local.get(this.storageKey);
      return storage[this.storageKey] || {};
    } catch (error) {
      console.error('Error getting storage:', error);
      return {};
    }
  }

  private async setStorage(data: Record<string, string[]>): Promise<void> {
    try {
      await browser.storage.local.set({ [this.storageKey]: data });
    } catch (error) {
      console.error('Error setting storage:', error);
    }
  }

  async getApprovedAddresses(domain: string): Promise<string[]> {
    try {
      const storage = await this.getStorage();
      return storage[domain] || [];
    } catch (error) {
      console.error('Error getting approved addresses:', error);
      return [];
    }
  }

  async addApprovedAddress(address: string, domain: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      const approvedAddresses = storage[domain] || [];
      
      if (!approvedAddresses.includes(address)) {
        approvedAddresses.push(address);
        storage[domain] = approvedAddresses;
        await this.setStorage(storage);
        console.log(`🔵 [ACCOUNT_STATE] Approved address ${address} for domain ${domain}`);
      }
    } catch (error) {
      console.error('Error adding approved address:', error);
    }
  }

  async isApproved(domain: string): Promise<boolean> {
    try {
      const approvedAddresses = await this.getApprovedAddresses(domain);
      const hasApprovedAddresses = approvedAddresses.length > 0;
      console.log(`🔵 [ACCOUNT_STATE] Domain ${domain} approved: ${hasApprovedAddresses}`);
      return hasApprovedAddresses;
    } catch (error) {
      console.error('Error checking domain approval:', error);
      return false;
    }
  }

  async removeApprovedAddress(address: string, domain: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      const approvedAddresses = storage[domain] || [];
      const filteredAddresses = approvedAddresses.filter(addr => addr !== address);
      
      if (filteredAddresses.length === 0) {
        delete storage[domain];
      } else {
        storage[domain] = filteredAddresses;
      }
      
      await this.setStorage(storage);
      console.log(`🔵 [ACCOUNT_STATE] Removed approval for address ${address} from domain ${domain}`);
    } catch (error) {
      console.error('Error removing approved address:', error);
    }
  }
}

export default AccountState; 