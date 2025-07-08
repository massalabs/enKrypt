import { OperationOptions, OperationStatus, Provider } from '@massalabs/massa-web3';


export class TransactionHandler {
  private provider: Provider;

  constructor(provider: Provider) {
    this.provider = provider;
  }


  async sendTransaction(
    to: string,
    amount: string,
    options: OperationOptions = {}
  ): Promise<string> {
    const operation = await this.provider.transfer( to, BigInt(amount),options);
    return operation.id;
  }

  async getTransactionInfo(opId: string): Promise<OperationStatus> {
    return this.provider.getOperationStatus(opId);
  }

  async estimateFee(): Promise<string> {
    const { minimalFee } = await this.provider.networkInfos();
    return minimalFee.toString();
  }
} 