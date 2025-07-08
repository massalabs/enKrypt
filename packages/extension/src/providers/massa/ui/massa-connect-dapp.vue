<template>
  <div class="massa-connect-dapp">
    <div class="header">
      <h2>Connect with Enkrypt</h2>
      <p>Massa Network</p>
    </div>

    <div class="content">
      <div class="domain-info">
        <h4>Connecting to: {{ Options.domain || 'Unknown Domain' }}</h4>
      </div>

      <div class="account-selection">
        <h3>Select Account</h3>
        <div v-if="accounts.length > 0" class="accounts-list">
          <div 
            v-for="account in accounts" 
            :key="account.address"
            class="account-item"
            :class="{ selected: selectedAccount?.address === account.address }"
            @click="selectAccount(account)"
          >
            <div class="account-info">
              <div class="account-name">{{ account.name || 'Massa Account' }}</div>
              <div class="account-address">{{ account.address }}</div>
              <div class="account-balance">Balance: {{ accountBalances[account.address] || '~' }} MAS</div>
            </div>
          </div>
        </div>
        <div v-else class="no-accounts">
          <p>No accounts found. Please create an account first.</p>
        </div>
      </div>

      <div class="info">
        <p>This will reveal your public address, wallet balance and activity to {{ Options.domain || 'this site' }}</p>
      </div>
    </div>

    <div class="buttons">
      <button class="btn btn-decline" @click="decline">Decline</button>
      <button class="btn btn-connect" @click="connect" :disabled="!selectedAccount">Connect</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { WindowPromiseHandler } from '@/libs/window-promise';
import { BaseNetwork } from '@/types/base-network';
import { ProviderRequestOptions } from '@/types/provider';
import PublicKeyRing from '@/libs/keyring/public-keyring';
import { getCustomError } from '@/libs/error';
import { SignerType } from '@enkryptcom/types';
import { EnkryptAccount } from '@enkryptcom/types';
import AccountState from '../libs/accounts-state';

const windowPromise = WindowPromiseHandler(1);
const network = ref<BaseNetwork>();
const accounts = ref<EnkryptAccount[]>([]);
const selectedAccount = ref<EnkryptAccount>();
const accountBalances = ref<Record<string, string>>({});

const Options = ref<ProviderRequestOptions>({
  domain: '',
  faviconURL: '',
  title: '',
  url: '',
  tabId: 0,
});

onBeforeMount(async () => {
  try {
    console.log('🟡 [UI] Initializing Massa connection UI...');
    
    const { Request, options } = await windowPromise;
    console.log('🟡 [UI] Got request data:', Request.value);
    console.log('🟡 [UI] Got options:', options);
    
    Options.value = options;
    
    // Get accounts
    const keyring = new PublicKeyRing();
    const massaAccounts = await keyring.getAccounts([SignerType.ed25519mas]);
    console.log('🟡 [UI] Found accounts:', massaAccounts);
    
    accounts.value = massaAccounts;
    
    if (massaAccounts.length > 0) {
      selectedAccount.value = massaAccounts[0];
      console.log('🟡 [UI] Selected first account:', selectedAccount.value);
      
      // Try to fetch balances (but don't fail if it doesn't work)
      try {
        if (network.value?.api) {
          const api = await network.value.api();
          for (const account of massaAccounts) {
            try {
              const balance = await api.getBalance(account.address);
              accountBalances.value[account.address] = balance || '0';
            } catch (e) {
              console.warn('🟡 [UI] Could not fetch balance for account:', account.address, e);
              accountBalances.value[account.address] = '~';
            }
          }
        }
      } catch (e) {
        console.warn('🟡 [UI] Could not fetch balances:', e);
        // Set default values
        massaAccounts.forEach(account => {
          accountBalances.value[account.address] = '~';
        });
      }
    }
    
    console.log('🟡 [UI] UI initialization completed');
  } catch (error) {
    console.error('❌ [UI] Error initializing UI:', error);
  }
});

const selectAccount = (account: EnkryptAccount) => {
  selectedAccount.value = account;
  console.log('🟡 [UI] Selected account:', account);
};

const decline = async () => {
  console.log('🟡 [UI] User declined connection');
  const { Resolve } = await windowPromise;
  Resolve.value({
    error: getCustomError('User rejected the request'),
  });
};

const connect = async () => {
  if (!selectedAccount.value) {
    console.error('❌ [UI] No account selected');
    return;
  }
  
  console.log('🟡 [UI] User approved connection for account:', selectedAccount.value);
  
  try {
    const { Resolve } = await windowPromise;
    const accountState = new AccountState();
    
    await accountState.addApprovedAddress(
      selectedAccount.value.address,
      Options.value.domain,
    );
    
    Resolve.value({
      result: JSON.stringify([selectedAccount.value.address]),
    });
  } catch (error) {
    console.error('❌ [UI] Error connecting:', error);
    const { Resolve } = await windowPromise;
    Resolve.value({
      error: getCustomError('Connection failed'),
    });
  }
};
</script>

<style lang="less" scoped>
.massa-connect-dapp {
  width: 400px;
  min-height: 500px;
  background: white;
  border-radius: 12px;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.header {
  text-align: center;
  margin-bottom: 24px;
  
  h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
    color: #333;
  }
  
  p {
    margin: 0;
    color: #666;
    font-size: 14px;
  }
}

.content {
  margin-bottom: 24px;
}

.domain-info {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  
  h4 {
    margin: 0;
    color: #333;
    font-size: 16px;
  }
}

.account-selection {
  margin-bottom: 20px;
  
  h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: #333;
  }
}

.accounts-list {
  max-height: 200px;
  overflow-y: auto;
}

.account-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #007bff;
    background: #f8f9ff;
  }
  
  &.selected {
    border-color: #007bff;
    background: #e3f2fd;
  }
}

.account-info {
  .account-name {
    font-weight: 600;
    color: #333;
    margin-bottom: 4px;
  }
  
  .account-address {
    font-family: monospace;
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
    word-break: break-all;
  }
  
  .account-balance {
    font-size: 12px;
    color: #007bff;
  }
}

.no-accounts {
  text-align: center;
  padding: 20px;
  color: #666;
}

.info {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 12px;
  
  p {
    margin: 0;
    font-size: 14px;
    color: #856404;
  }
}

.buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &.btn-decline {
    background: #f8f9fa;
    color: #6c757d;
    
    &:hover {
      background: #e9ecef;
    }
  }
  
  &.btn-connect {
    background: #007bff;
    color: white;
    
    &:hover:not(:disabled) {
      background: #0056b3;
    }
    
    &:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  }
}
</style> 