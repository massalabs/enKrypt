import { InternalMethods, InternalOnMessageResponse } from '@/types/messenger';
import { bufferToHex } from '@enkryptcom/utils';
import sendUsingInternalMessengers from '@/libs/messenger/internal-messenger';
import { BaseNetwork } from '@/types/base-network';
import { EnkryptAccount } from '@enkryptcom/types';
import { Address, OperationManager, OperationType, PublicKey, TransferOperation } from '@massalabs/massa-web3';
import { MassaNetworkOptions } from '../../types';

export interface MassaTransactionOptions {
  account: EnkryptAccount;
  network: BaseNetwork;
  payload: {
    from: string;
    to: string;
    amount: string;
    fee: string;
    expirePeriod: number;
  };
}

export interface MassaSignedTransaction {
  from: string;
  to: string;
  amount: string;
  fee: string;
  expirePeriod: number;
  signature: string;
  publicKey: string;
  serializedHex: string;
}

/**
 * Sign a Massa transaction
 */
export const MassaTransactionSigner = (
  options: MassaTransactionOptions,
): Promise<MassaSignedTransaction> => {
  const { account, payload, network } = options;
  
  // Create the message to sign (similar to Ethereum's getHashedMessageToSign)
  const operationDetails: TransferOperation = {
    type: OperationType.Transaction,
    amount: BigInt(payload.amount),
    recipientAddress: Address.fromString(payload.to) ,
    fee: BigInt(payload.fee),
    expirePeriod: payload.expirePeriod,//3060678
  };
  console.log('🔵 [MASSA_SIGNER] expirePeriod:', payload.expirePeriod);
  console.log('🔵 [MASSA_SIGNER] network:', network);
  console.log('🔵 [MASSA_SIGNER] operationDetails:', operationDetails);

  const chainId = (network as MassaNetworkOptions).chainId;

  const publicKey = PublicKey.fromString(account.publicKey);
  console.log('🔵 [MASSA_SIGNER] Public key:', publicKey);
  console.log('🔵 [MASSA_SIGNER] chainId:', chainId);
  console.log('🔵 [MASSA_SIGNER] account:', account.address);
  const serialized = OperationManager.canonicalize(chainId!, operationDetails, publicKey);
  console.log('🔵 [MASSA_SIGNER] original serialized:', serialized);
  console.log('🔵 [MASSA_SIGNER] original serialized length:', serialized.length);
  const bufferTosign = bufferToHex(serialized);
  
  return sendUsingInternalMessengers({
    method: InternalMethods.sign,
    params: [bufferTosign, account],
  }).then(res => {
    if (res.error) {
      return Promise.reject(res);
    } else {
      const signature = JSON.parse(res.result as string) || '';
      
      const signedTx: MassaSignedTransaction = {
        ...payload,
        signature,
        publicKey: account.publicKey,
        serializedHex: bufferToHex(OperationManager.serialize(operationDetails)),
      };
      
      return signedTx;
    }
  });
};

/**
 * Sign a Massa message
 */
export const MassaMessageSigner = (
  options: {
    account: EnkryptAccount;
    network: BaseNetwork;
    payload: Buffer;
  },
): Promise<InternalOnMessageResponse> => {
  const { account, payload } = options;
  
  const msgHash = bufferToHex(payload);
  return sendUsingInternalMessengers({
    method: InternalMethods.sign,
    params: [msgHash, account],
  }).then(res => {
    if (res.error) return res;
    return {
      result: res.result,
    };
  });
}; 