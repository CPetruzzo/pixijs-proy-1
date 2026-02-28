import type { AdMobRewardItem } from "@capacitor-community/admob";
import { AdMob, BannerAdSize, BannerAdPosition, RewardAdPluginEvents } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";

export class AdMobManager {
	private static _defaultAdId: string = "ca-app-pub-3940256099942544/2247696110"; // Banner Test
	private static _interstitialId: string = "ca-app-pub-3940256099942544/1033173712"; // Interstitial Test
	private static _isTestingMode: boolean = true;
	private static _rewardId: string = "ca-app-pub-3940256099942544/5224354917"; // ID de Test para Rewarded
	/**
	 * Inicializa el SDK. Se llama una sola vez en index.ts.
	 */
	public static async initialize(isTesting: boolean = true, defaultId?: string): Promise<void> {
		if (!Capacitor.isNativePlatform()) {
			return;
		}

		this._isTestingMode = isTesting;
		if (defaultId) {
			this._defaultAdId = defaultId;
		}

		try {
			await AdMob.initialize({
				initializeForTesting: this._isTestingMode, // Propiedad validada por tus opciones
			});
			console.log("AdMobManager: SDK inicializado con éxito.");
		} catch (error) {
			console.error("AdMobManager: Error en inicialización", error);
		}
	}

	/**
	 * BANNERS
	 */
	public static async showBanner(size: BannerAdSize = BannerAdSize.BANNER, position: BannerAdPosition = BannerAdPosition.BOTTOM_CENTER, customId?: string): Promise<void> {
		if (!Capacitor.isNativePlatform()) {
			return;
		}

		try {
			await AdMob.showBanner({
				adId: customId || this._defaultAdId,
				adSize: size,
				position: position,
				isTesting: this._isTestingMode,
				margin: 0,
			});
		} catch (error) {
			console.error("AdMobManager: Error al mostrar el banner", error);
		}
	}

	public static async hideBanner(): Promise<void> {
		if (!Capacitor.isNativePlatform()) {
			return;
		}
		try {
			await AdMob.removeBanner();
		} catch (error) {
			console.error("AdMobManager: Error al quitar el banner");
		}
	}

	/**
	 * INTERSTITIALS (Pantalla completa)
	 * Los interstitials se deben preparar antes de mostrarse.
	 */
	public static async showInterstitial(customId?: string): Promise<void> {
		if (!Capacitor.isNativePlatform()) {
			return;
		}

		try {
			// 1. Preparamos el anuncio
			await AdMob.prepareInterstitial({
				adId: customId || this._interstitialId,
				isTesting: this._isTestingMode,
			});

			// 2. Lo mostramos
			await AdMob.showInterstitial();
			console.log("AdMobManager: Interstitial mostrado.");
		} catch (error) {
			console.error("AdMobManager: Error con el Interstitial", error);
		}
	}

	/**
	 * REWARDED ADS
	 * @param onRewardCallback Función que se ejecuta al ganar la recompensa.
	 */
	public static async showRewardedAd(onRewardCallback: (reward: AdMobRewardItem) => void, customId?: string): Promise<void> {
		if (!Capacitor.isNativePlatform()) {
			// En PC/Web, simulamos la recompensa para poder testear
			console.log("AdMobManager: Simulando recompensa en Web...");
			onRewardCallback({ amount: 1, type: "reward" });
			return;
		}

		try {
			// Usamos await para asegurarnos de tener el handle del listener
			// eslint-disable-next-line @typescript-eslint/await-thenable
			const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
				onRewardCallback(reward);
				rewardListener.remove(); // Se limpia correctamente
			});

			// 2. Preparar
			await AdMob.prepareRewardVideoAd({
				adId: customId || this._rewardId,
			});

			// 3. Mostrar
			await AdMob.showRewardVideoAd();
		} catch (error) {
			console.error("AdMobManager: Error en Rewarded Ad", error);
		}
	}
}
