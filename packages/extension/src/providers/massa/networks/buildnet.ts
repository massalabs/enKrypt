import { NetworkNames } from '@enkryptcom/types';
import { BaseNetwork } from '@/types/base-network';
import MassaAPI from '../libs/api';
import { SignerType } from '@enkryptcom/types';
import { ProviderName } from '@/types/provider';
import createIcon from '../libs/blockies';
import { CHAIN_ID, PublicApiUrl } from '@massalabs/massa-web3';
import { MassaNetworkOptions } from '../types';
import ActivityState from '@/libs/activity-state';
import { Activity } from '@/types/activity';
import { AssetsType } from '@/types/provider';
import { fromBase } from '@enkryptcom/utils';
import { formatFloatingPointValue } from '@/libs/utils/number-formatter';
import MarketData from '@/libs/market-data';
import BigNumber from 'bignumber.js';
import icon from './icons/Massa_logo.webp';

const buildnetOptions: MassaNetworkOptions = {
  name: NetworkNames.MassaBuildnet,
  name_long: 'Massa Buildnet',
  homePage: 'https://massa.net/',
  blockExplorerTX: 'https://www.massexplo.com/tx/[[txHash]]?network=buildnet',
  blockExplorerAddr: 'https://www.massexplo.com/address/[[address]]?network=buildnet',
  isTestNetwork: true,
  currencyName: 'MAS',
  currencyNameLong: 'Massa',
  node: PublicApiUrl.Buildnet,
  icon,
  decimals: 9,
  signer: [SignerType.ed25519mas],
  displayAddress: (address: string) => address,
  provider: ProviderName.massa,
  identicon: createIcon,
  basePath: "m/44'/632'",
  chainId: CHAIN_ID.Buildnet,
  coingeckoID: 'massa',
  api: async () => {
    const api = new MassaAPI(PublicApiUrl.Buildnet);
    await api.init();
    return api;
  },
};

class MassaNetwork extends BaseNetwork {
  chainId: bigint;
  constructor(options: MassaNetworkOptions) {
    super(options);
    this.chainId = options.chainId!;
  }

  async getAllTokens(): Promise<any[]> {
    return [];
  }

  async getAllTokenInfo(address: string): Promise<AssetsType[]> {
    try {
      console.log('🔵 [MASSA_NETWORK] Getting token info for address:', address);
      
      // Get native MAS balance
      const api = await this.api() as MassaAPI;
      const balance = await api.getBalance(address);
      const balanceFormatted = fromBase(balance, this.decimals);
      const balanceDisplayFormatted = formatFloatingPointValue(balanceFormatted).value;
      
      // Get MAS price from CoinGecko
      let price = '0';
      let priceChangePercentage = 0;
      let sparklineData = '';
      
      try {
        if (this.coingeckoID) {
          const marketData = new MarketData();
          const tokenPrice = await marketData.getTokenPrice(this.coingeckoID);
          const marketInfos = await marketData.getMarketData([this.coingeckoID]);
          const marketInfo = marketInfos[0];
          
          if (tokenPrice) {
            price = tokenPrice;
          }
          
          if (marketInfo) {
            priceChangePercentage = marketInfo.price_change_percentage_24h || 0;
            if (marketInfo.sparkline_in_24h?.price) {
              // Convert sparkline data to string format expected by UI
              sparklineData = JSON.stringify(marketInfo.sparkline_in_24h.price.slice(-25)); // Last 25 points
            }
          }
        }
      } catch (priceError) {
        console.warn('🟡 [MASSA_NETWORK] Could not fetch price data:', priceError);
      }
      
      // Calculate USD values
      const balanceUSD = new BigNumber(balanceDisplayFormatted).times(price).toNumber();
      const balanceUSDf = new BigNumber(balanceDisplayFormatted).times(price).toString();
      const priceFormatted = formatFloatingPointValue(price).value;
      
      const nativeTokenAsset: AssetsType = {
        name: this.currencyNameLong,
        symbol: this.currencyName,
        icon: this.icon,
        balance: balanceFormatted,
        balancef: balanceDisplayFormatted,
        balanceUSD,
        balanceUSDf,
        value: price,
        valuef: priceFormatted,
        decimals: this.decimals,
        sparkline: sparklineData,
        priceChangePercentage,
        // No contract for native token
      };
      
      console.log('🔵 [MASSA_NETWORK] Native token asset:', nativeTokenAsset);
      return [nativeTokenAsset];
      
    } catch (error) {
      console.error('❌ [MASSA_NETWORK] Error fetching token info:', error);
      return [];
    }
  }

  async getAllActivity(address: string): Promise<Activity[]> {
    try {
      console.log('🔵 [MASSA_NETWORK] Getting all activity for address:', address);
      const activityState = new ActivityState();
      const activities = await activityState.getAllActivities({
        address,
        network: this.name,
      });
      console.log('🔵 [MASSA_NETWORK] Found activities:', activities.length);
      return activities;
    } catch (error) {
      console.error('❌ [MASSA_NETWORK] Error fetching activities:', error);
      return [];
    }
  }
}

const buildnet = new MassaNetwork(buildnetOptions);

export default buildnet; 