import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.runfall.app',
	appName: 'RunFall',
	webDir: 'dist',
	android: {
		backgroundColor: "#00000000"  // Fondo transparente para que se vea el banner debajo
	}
};

export default config;
