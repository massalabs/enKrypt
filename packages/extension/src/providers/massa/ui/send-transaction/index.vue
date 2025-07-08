<template>
  <div class="container">
    <div class="send-transaction">
      <send-header
        :is-send-token="true"
        :is-nft-available="false"
        @close="close"
        @toggle-type="toggleSelector"
      />

      <send-address-input
        ref="addressInputFrom"
        :from="true"
        :value="addressFrom"
        :network="network"
        :disable-direct-input="true"
        @click="toggleSelectContactFrom(true)"
        @update:input-address="inputAddressFrom"
        @toggle:show-contacts="toggleSelectContactFrom"
      />

      <send-from-contacts-list
        :show-accounts="isOpenSelectContactFrom"
        :account-info="accountInfo"
        :address="addressFrom"
        :network="network"
        @selected:account="selectAccountFrom"
        @close="toggleSelectContactFrom"
      />

      <send-address-input
        ref="addressInputTo"
        :value="addressTo"
        :network="network"
        @update:input-address="inputAddressTo"
        @toggle:show-contacts="toggleSelectContactTo"
      />

      <send-contacts-list
        :show-accounts="isOpenSelectContactTo"
        :account-info="accountInfo"
        :address="addressTo"
        :network="network"
        @selected:account="selectAccountTo"
        @update:paste-from-clipboard="addressInputTo.pasteFromClipboard()"
        @close="toggleSelectContactTo"
      />

      <send-input-amount
        :amount="amount"
        :fiat-value="fiatValue"
        :has-enough-balance="hasEnoughBalance"
        :show-max="true"
        @update:input-amount="inputAmount"
        @update:input-set-max="setMaxValue"
      />

      <div class="fee-input-container">
        <label>Fee (MAS)</label>
        <input
          v-model="fee"
          type="number"
          placeholder="0.01"
          class="fee-input"
          step="0.000000001"
          min="0"
        />
        <div class="fee-info">Minimal fee from network</div>
      </div>

      <send-alert
        v-show="!hasEnoughBalance && amount && parseFloat(amount) > 0"
        :native-symbol="network.name"
        :price="fiatValue"
        :is-balance-zero="parseFloat(accountBalance) === 0"
        :native-value="insufficientAmount"
        :decimals="9"
        :not-enough="!hasEnoughBalance"
      />

      <div class="send-transaction__buttons">
        <div class="send-transaction__buttons-cancel">
          <base-button title="Cancel" :click="close" :no-background="true" />
        </div>
        <div class="send-transaction__buttons-send">
          <base-button
            :title="sendButtonTitle"
            :click="sendAction"
            :disabled="!isInputsValid"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, PropType, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SendHeader from '@/providers/common/ui/send-transaction/send-header.vue';
import SendAddressInput from './components/send-address-input.vue';
import SendContactsList from '@/providers/common/ui/send-transaction/send-contacts-list.vue';
import SendFromContactsList from '@/providers/common/ui/send-transaction/send-from-contacts-list.vue';
import SendInputAmount from '@/providers/common/ui/send-transaction/send-input-amount.vue';
import BaseButton from '@action/components/base-button/index.vue';
import SendAlert from '@/providers/common/ui/send-transaction/send-alert.vue';
import { AccountsHeaderData } from '@action/types/account';
import { BaseNetwork } from '@/types/base-network';
import BigNumber from 'bignumber.js';
import { fromBase, toBase, isValidDecimals } from '@enkryptcom/utils';
import {
  isNumericPositive,
} from '@/libs/utils/number-formatter';
import { Address, formatMas, Mas, JsonRpcProvider, Account, PrivateKey } from '@massalabs/massa-web3';
import MassaAPI from '../../libs/api';
import { WindowPromiseHandler } from '@/libs/window-promise';
import { bufferToHex } from '@enkryptcom/utils';
import PublicKeyRing from '@/libs/keyring/public-keyring';
import KeyRingBase from '@/libs/keyring/keyring';
import { MassaSigner } from '@enkryptcom/signer-massa';
import { VerifyTransactionParams, TxFeeInfo } from '../../types';
import { routes as RouterNames } from '@/ui/action/router';

interface AccountInfo {
  address: string;
  balance: string;
  name: string;
  publicKey: string;
  type: string;
}

interface TransactionParams {
  from: string;
  to: string;
  amount: string;
  fee?: string;
  data?: string;
  validityStartPeriod?: number;
}

const props = defineProps({
  network: {
    type: Object as PropType<BaseNetwork>,
    default: () => ({}),
  },
  accountInfo: {
    type: Object as PropType<AccountsHeaderData>,
    default: () => ({}),
  },
});

const route = useRoute();
const router = useRouter();
const addressInputTo = ref();
const addressInputFrom = ref();
const amount = ref<string>('');
const fee = ref<string>('0.01');
const addressTo = ref<string>('');
const addressFrom = ref<string>('');
const isOpenSelectContactTo = ref<boolean>(false);
const isOpenSelectContactFrom = ref<boolean>(false);

// WindowPromise for handling the request/response
const windowPromise = WindowPromiseHandler(4); // 4 parameters: txParams, account, network, options

// Parse the transaction data from the route
const transactionData = computed(() => {
  try {
    if (!route.query.params || typeof route.query.params !== 'string') {
      console.warn('No transaction params found in route query');
      return null;
    }
    const params = JSON.parse(route.query.params);
    return params[0] as TransactionParams;
  } catch (error) {
    console.error('Error parsing transaction params:', error);
    return null;
  }
});

const account = computed(() => {
  try {
    if (!route.query.params || typeof route.query.params !== 'string') {
      console.warn('No account params found in route query, using props');
      // Create a proper AccountInfo object from AccountsHeaderData
      if (props.accountInfo?.selectedAccount) {
        const selectedIndex = props.accountInfo.activeAccounts.findIndex(
          acc => acc.address === props.accountInfo.selectedAccount?.address
        );
        const balance = selectedIndex >= 0 
          ? props.accountInfo.activeBalances[selectedIndex] || '0'
          : '0';
        
        return {
          address: props.accountInfo.selectedAccount.address,
          balance: balance,
          name: props.accountInfo.selectedAccount.name,
          publicKey: props.accountInfo.selectedAccount.publicKey || '',
          type: props.accountInfo.selectedAccount.walletType || ''
        };
      }
      return {
        address: '',
        balance: '0',
        name: '',
        publicKey: '',
        type: ''
      };
    }
    const params = JSON.parse(route.query.params);
    console.log('SEND component >>>>>params', params);
    console.log('SEND component >>>>>account', params[1]);

    return params[1] as AccountInfo;
  } catch (error) {
    console.error('Error parsing account params:', error);
    // Create a proper AccountInfo object from AccountsHeaderData
    if (props.accountInfo?.selectedAccount) {
      const selectedIndex = props.accountInfo.activeAccounts.findIndex(
        acc => acc.address === props.accountInfo.selectedAccount?.address
      );
      const balance = selectedIndex >= 0 
        ? props.accountInfo.activeBalances[selectedIndex] || '0'
        : '0';
      
      return {
        address: props.accountInfo.selectedAccount.address,
        balance: balance,
        name: props.accountInfo.selectedAccount.name,
        publicKey: props.accountInfo.selectedAccount.publicKey || '',
        type: props.accountInfo.selectedAccount.walletType || ''
      };
    }
    return {
      address: '',
      balance: '0',
      name: '',
      publicKey: '',
      type: ''
    };
  }
});

const network = computed(() => {
  try {
    if (!route.query.params || typeof route.query.params !== 'string') {
      console.warn('No network params found in route query, using props');
      return props.network;
    }
    const params = JSON.parse(route.query.params);
    return params[2] as BaseNetwork;
  } catch (error) {
    console.error('Error parsing network params:', error);
    return props.network;
  }
});

const accountBalance = computed(() => {
  // account.value.balance is already a float string (like "10.999"), not base units
  // So we just return it directly for display purposes
  return account.value.balance;
});

const fiatValue = computed(() => {
  // For now, we'll use a placeholder value. In a real implementation,
  // this would come from a price API
  return '0.01'; // Placeholder USD value
});

const sendAmount = computed(() => {
  if (amount.value && amount.value !== '') return amount.value;
  return '0';
});

const hasEnoughBalance = computed(() => {
  if (!isNumericPositive(sendAmount.value)) {
    return true;
  }
  
  // Convert all values to base units (smallest unit) for comparison
  const amountBase = toBase(sendAmount.value, 9);
  const balanceBase = new BigNumber(account.value.balance).times(10 ** 9).toString(); // Convert float to base units
  const feeBase = toBase(fee.value, 9);
  
  const amountNum = BigInt(amountBase);
  const balanceNum = BigInt(balanceBase);
  const feeNum = BigInt(feeBase);
  
  return (amountNum + feeNum) <= balanceNum;
});

const insufficientAmount = computed(() => {
  if (!isNumericPositive(sendAmount.value)) {
    return '0';
  }
  
  // Convert all values to base units (smallest unit) for comparison
  const amountBase = toBase(sendAmount.value, 9);
  const balanceBase = new BigNumber(account.value.balance).times(10 ** 9).toString(); // Convert float to base units
  const feeBase = toBase(fee.value, 9);
  
  const amountNum = BigInt(amountBase);
  const balanceNum = BigInt(balanceBase);
  const feeNum = BigInt(feeBase);
  const totalNeeded = amountNum + feeNum;
  
  if (totalNeeded > balanceNum) {
    const insufficientBase = totalNeeded - balanceNum;
    return fromBase(insufficientBase.toString(), 9);
  }
  return '0';
});

const sendButtonTitle = computed(() => {
  let title = 'Send';
  if (isNumericPositive(sendAmount.value) && parseFloat(sendAmount.value) > 0) {
    title = 'Send ' + sendAmount.value + ' MAS';
  }
  return title;
});

const isInputsValid = computed<boolean>(() => {
  console.log('🟡 [UI] === Validation Debug ===');
  console.log('🟡 [UI] addressTo.value:', addressTo.value);
  console.log('🟡 [UI] sendAmount.value:', sendAmount.value);
  console.log('🟡 [UI] hasEnoughBalance.value:', hasEnoughBalance.value);
  
  if (!addressTo.value) {
    console.log('❌ [UI] No address provided');
    return false;
  }
  
  try {
    Address.fromString(addressTo.value);
    console.log('✅ [UI] Address is valid');
  } catch (error) {
    console.log('❌ [UI] Invalid address:', error);
    return false;
  }
  
  if (!isValidDecimals(sendAmount.value, 9)) {
    console.log('❌ [UI] Invalid decimals for amount');
    return false;
  }
  
  const sendAmountBigNumber = new BigNumber(sendAmount.value);
  if (sendAmountBigNumber.isNaN()) {
    console.log('❌ [UI] Amount is NaN');
    return false;
  }
  if (sendAmountBigNumber.lte(0)) {
    console.log('❌ [UI] Amount is <= 0');
    return false;
  }
  
  const result = hasEnoughBalance.value;
  console.log('✅ [UI] All validations passed, hasEnoughBalance:', result);
  return result;
});

onMounted(async () => {
  console.log('🟡 [UI] === onMounted Debug ===');
  console.log('🟡 [UI] windowPromise object:', windowPromise);
  
  try {
    console.log('🟡 [UI] Getting request data from window promise...');
    
    // Try to get the request data from the window promise with a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Window promise timeout')), 5000);
    });
    
    const windowPromiseResult = await Promise.race([windowPromise, timeoutPromise]) as any;
    console.log('🟡 [UI] Got Request from window promise:', windowPromiseResult);
    
    // Parse the transaction data from the request
    const txParams = windowPromiseResult.Request.value.params![0];
    const accountData = windowPromiseResult.Request.value.params![1];
    const networkData = windowPromiseResult.Request.value.params![2];
    const options = windowPromiseResult.Request.value.params![3];
    
    console.log('🟡 [UI] Received request data:', { txParams, accountData, networkData, options });
    
    // Set the from address from the transaction parameters
    if (txParams.from) {
      addressFrom.value = txParams.from;
      console.log('🟡 [UI] Set from address:', addressFrom.value);
    }
    
    // Set the to address from the transaction parameters
    if (txParams.to) {
      addressTo.value = txParams.to;
      console.log('🟡 [UI] Set to address:', addressTo.value);
    }
    
    // Set the amount from the transaction parameters
    if (txParams.amount) {
      amount.value = fromBase(txParams.amount, 9);
      console.log('🟡 [UI] Set amount:', amount.value);
    }
    
    // Set the fee from the transaction parameters or options
    if (txParams.fee) {
      fee.value = fromBase(txParams.fee, 9);
      console.log('🟡 [UI] Set fee from txParams:', fee.value);
    } else if (options?.fee) {
      fee.value = fromBase(options.fee.toString(), 9);
      console.log('🟡 [UI] Set fee from options:', fee.value);
    }
    
    // Update the account object with the received data
    if (accountData) {
      console.log('🟡 [UI] Account data received:', accountData);
      // The account data should already be in the correct format
      // We can use it directly or update our local account object
    }
    
    // Update the network object with the received data
    if (networkData) {
      console.log('🟡 [UI] Network data received:', networkData);
      // The network data should already be in the correct format
      // We can use it directly or update our local network object
    }
    
  } catch (error) {
    console.log('🟡 [UI] No data received from window promise (this is normal when accessed directly):', error.message);
    console.log('🟡 [UI] Using default values and props data');
    
    // When accessed directly (not from background script), use default values
    // The component should work with the data from props and route
  }
  
  // Fetch minimal fee from the network
  try {
    console.log('🟡 [UI] Fetching minimal fee from network...');
    const api = await network.value.api() as MassaAPI;
    const minimalFeeBase = await api.getMinimalFee();
    const minimalFee = formatMas(BigInt(minimalFeeBase));
    fee.value = minimalFee;
    console.log(`🟡 [UI] Minimal fee fetched: ${fee.value}`);
  } catch (error) {
    console.error('❌ [UI] Error fetching minimal fee:', error);
    // Keep default fee of 0.01 if API call fails
  }
});

const updateAccountBalance = async () => {
  if (addressFrom.value) {
    try {
      const api = await network.value.api() as MassaAPI;
      const balance = await api.getBalance(addressFrom.value);
      // Update the account object with the new balance
      if (account.value) {
        account.value.balance = balance;
      }
    } catch (error) {
      console.error('Error updating account balance:', error);
    }
  }
};

const close = () => {
  console.log('🟡 [UI] Closing transaction window');
  router.go(-1);
};

const inputAddressTo = (text: string) => {
  addressTo.value = text;
};

const inputAddressFrom = (text: string) => {
  addressFrom.value = text;
};

const toggleSelectContactTo = (open: boolean) => {
  isOpenSelectContactTo.value = open;
};

const toggleSelectContactFrom = (open: boolean) => {
  isOpenSelectContactFrom.value = open;
};

const selectAccountTo = (account: string) => {
  addressTo.value = account;
  isOpenSelectContactTo.value = false;
};

const selectAccountFrom = (account: string) => {
  addressFrom.value = account;
  isOpenSelectContactFrom.value = false;
  // Update the account balance when selecting a different account
  updateAccountBalance();
};

const inputAmount = (inputAmount: string) => {
  if (inputAmount === '') {
    inputAmount = '0';
  }
  const inputAmountBn = new BigNumber(inputAmount);
  amount.value = inputAmountBn.lt(0) ? '0' : inputAmount;
};

const setMaxValue = () => {
  const balanceBase = new BigNumber(account.value.balance).times(10 ** 9).toString(); // Convert float to base units
  const feeBase = toBase(fee.value, 9);
  
  const balanceNum = BigInt(balanceBase);
  const feeNum = BigInt(feeBase);
  const maxAmountBase = balanceNum - feeNum;
  
  if (maxAmountBase > BigInt(0)) {
    amount.value = fromBase(maxAmountBase.toString(), 9);
  } else {
    amount.value = '0';
  }
};

const toggleSelector = (isTokenSend: boolean) => {
  // Massa only supports token sending for now
};

const sendAction = async () => {
  console.log('🟡 [UI] === Send Action Debug ===');
  console.log('🟡 [UI] isInputsValid.value:', isInputsValid.value);
  console.log('🟡 [UI] addressTo.value:', addressTo.value);
  console.log('🟡 [UI] amount.value:', amount.value);
  console.log('🟡 [UI] fee.value:', fee.value);
  
  if (!isInputsValid.value) {
    console.log('❌ [UI] Inputs are not valid, aborting send action');
    return;
  }

  try {
    // Check if this is called from background script (has WindowPromise data)
    let isFromBackground = false;
    try {
      const { Resolve } = await Promise.race([
        windowPromise, 
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
      ]) as any;
      
      if (Resolve) {
        isFromBackground = true;
        console.log('🟡 [UI] Called from background script, sending response back...');
        
        const transactionParams = {
          from: addressFrom.value,
          to: addressTo.value,
          amount: toBase(amount.value, 9),
          fee: toBase(fee.value, 9),
        };
        
        Resolve.value({
          result: JSON.stringify(transactionParams)
        });
        
        console.log('✅ [UI] Transaction parameters sent to background script');
        close();
        return;
      }
    } catch (error) {
      // No WindowPromise available - this is normal for direct UI access
      isFromBackground = false;
    }
    
    // When accessed directly from extension UI, navigate to verify-transaction
    if (!isFromBackground) {
      console.log('🟡 [UI] Creating transaction data for verify step');
      
      // Create verify transaction params
      const txVerifyInfo: VerifyTransactionParams = {
        TransactionData: {
          from: addressFrom.value,
          to: addressTo.value,
          value: amount.value,
          data: '0x' as `0x${string}`, // Massa doesn't use data field like Ethereum
        },
        toToken: {
          amount: toBase(amount.value, 9), // Massa has 9 decimals
          decimals: 9,
          icon: network.value.icon,
          symbol: network.value.currencyName,
          valueUSD: fiatValue.value,
          name: network.value.currencyNameLong,
          price: '0', // TODO: Get actual MAS price
        },
        fromAddress: addressFrom.value,
        fromAddressName: account.value.name,
        txFee: {
          nativeValue: fee.value,
          fiatValue: fiatValue.value,
          nativeSymbol: network.value.currencyName,
          fiatSymbol: 'USD',
        } as TxFeeInfo,
        toAddress: addressTo.value,
      };
      
      console.log('🟡 [UI] Transaction verify info:', txVerifyInfo);
      
      // Navigate to verify transaction component
      const routedRoute = router.resolve({
        name: RouterNames.verify.name, // 'verify-transaction'
        query: {
          id: network.value.name,
          txData: Buffer.from(JSON.stringify(txVerifyInfo), 'utf8').toString('base64'),
        },
      });
      
      console.log('🟡 [UI] Navigating to verify transaction:', routedRoute.href);
      router.push(routedRoute);
    }
  } catch (error) {
    console.error('❌ [UI] Error in sendAction:', error);
    console.error('❌ [UI] Error stack:', error.stack);
  }
};
</script>

<style lang="less" scoped>
@import '@action/styles/theme.less';
@import '@action/styles/custom-scroll.less';

.container {
  width: 100%;
  height: 600px;
  background-color: @white;
  box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.16);
  margin: 0;
  box-sizing: border-box;
  position: relative;
}

.send-transaction {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;

  &__buttons {
    position: absolute;
    left: 0;
    bottom: 0;
    padding: 0 32px 32px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-direction: row;
    width: 100%;
    box-sizing: border-box;

    &-cancel {
      width: 170px;
    }

    &-send {
      width: 218px;
    }
  }
}

.fee-input-container {
  margin: 0 32px 8px 32px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid @gray02;
  border-radius: 10px;
  width: calc(~'100% - 64px');
  box-sizing: border-box;
  position: relative;

  label {
    display: block;
    margin-bottom: 8px;
    font-style: normal;
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.5px;
    color: @secondaryLabel;
  }

  .fee-input {
    width: 100%;
    height: 24px;
    font-style: normal;
    font-weight: 400;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.25px;
    color: @primaryLabel;
    border: 0 none;
    outline: none;
    padding: 0;
    background: transparent;
    caret-color: @primary;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &[type='number'] {
      -moz-appearance: textfield;
    }
  }

  .fee-info {
    margin-top: 8px;
    font-style: normal;
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.5px;
    color: @tertiaryLabel;
  }
}
</style> 