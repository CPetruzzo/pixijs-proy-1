import { ref, set, get } from "firebase/database";
import { db } from "../../../..";
import { DataManager } from "../../../../engine/datamanager/DataManager";

export class UsernameManager {
	private static instance: UsernameManager | null = null;
	private username: string | null = null;
	private playerId: string;
	private usernameInput: HTMLInputElement | null = null;
	private saveButton: HTMLButtonElement | null = null;
	private initializationPromise: Promise<string> | null = null;

	private static readonly PLAYER_ID_KEY = "CACHO_WORLD_PLAYER_ID";

	private constructor(playerId: string) {
		this.playerId = playerId;
		// Save playerId to localStorage
		DataManager.setValue(UsernameManager.PLAYER_ID_KEY, playerId);
	}

	public static getInstance(playerId: string): UsernameManager {
		// If instance exists but playerId is different, create new instance
		if (UsernameManager.instance && UsernameManager.instance.playerId !== playerId) {
			UsernameManager.instance.cleanup();
			UsernameManager.instance = null;
		}

		if (!UsernameManager.instance) {
			UsernameManager.instance = new UsernameManager(playerId);
		}
		return UsernameManager.instance;
	}

	/**
	 * Get saved playerId from localStorage or generate a new one
	 */
	public static getOrCreatePlayerId(): string {
		// Try to get saved playerId from localStorage
		const savedPlayerId = DataManager.getValue<string>(UsernameManager.PLAYER_ID_KEY);

		if (savedPlayerId) {
			console.log(`Found saved playerId: ${savedPlayerId}`);
			return savedPlayerId;
		}

		// Generate new playerId if not found
		const newPlayerId = Date.now().toString();
		console.log(`Generated new playerId: ${newPlayerId}`);
		DataManager.setValue(UsernameManager.PLAYER_ID_KEY, newPlayerId);
		return newPlayerId;
	}

	public async initialize(): Promise<string> {
		// If already initializing, return the existing promise
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		// If username already loaded, return it
		if (this.username) {
			return this.username;
		}

		// Start initialization
		this.initializationPromise = this.performInitialization();
		return this.initializationPromise;
	}

	private async performInitialization(): Promise<string> {
		// Try to load username from Firebase
		const username = await this.loadUsernameFromFirebase();

		if (username) {
			this.username = username;
			console.log(`Username loaded from Firebase: ${username}`);
			return username;
		}

		// If no username exists, show the form
		return this.showUsernameForm();
	}

	private async loadUsernameFromFirebase(): Promise<string | null> {
		try {
			const usernameRef = ref(db, `usernames/${this.playerId}`);
			const snapshot = await get(usernameRef);

			if (snapshot.exists()) {
				return snapshot.val() as string;
			}
			return null;
		} catch (error) {
			console.error("Error loading username from Firebase:", error);
			return null;
		}
	}

	private showUsernameForm(): Promise<string> {
		return new Promise((resolve) => {
			// Create input
			this.usernameInput = document.createElement("input");
			this.usernameInput.type = "text";
			this.usernameInput.placeholder = "Enter your username";
			this.usernameInput.style.position = "absolute";
			this.usernameInput.style.top = "10px";
			this.usernameInput.style.left = "10px";
			this.usernameInput.style.width = "200px";
			this.usernameInput.style.zIndex = "2000";
			document.body.appendChild(this.usernameInput);

			// Create button
			this.saveButton = document.createElement("button");
			this.saveButton.innerHTML = "Save Username";
			this.saveButton.style.position = "absolute";
			this.saveButton.style.top = "40px";
			this.saveButton.style.left = "10px";
			this.saveButton.style.zIndex = "2000";
			document.body.appendChild(this.saveButton);

			// Handle save
			this.saveButton.addEventListener("click", async () => {
				const inputValue = this.usernameInput.value.trim();
				if (inputValue !== "") {
					this.username = inputValue;
					await this.saveUsernameToFirebase(inputValue);

					// Remove form elements
					this.hideUsernameForm();

					resolve(inputValue);
				} else {
					alert("Please enter a valid username.");
				}
			});

			// Handle Enter key
			this.usernameInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					this.saveButton.click();
				}
			});
		});
	}

	private async saveUsernameToFirebase(username: string): Promise<void> {
		try {
			const usernameRef = ref(db, `usernames/${this.playerId}`);
			await set(usernameRef, username);
			console.log("Username saved to Firebase.");
		} catch (error) {
			console.error("Error saving username to Firebase:", error);
		}
	}

	private hideUsernameForm(): void {
		if (this.usernameInput && this.usernameInput.parentNode) {
			this.usernameInput.parentNode.removeChild(this.usernameInput);
			this.usernameInput = null;
		}
		if (this.saveButton && this.saveButton.parentNode) {
			this.saveButton.parentNode.removeChild(this.saveButton);
			this.saveButton = null;
		}
	}

	public getUsername(): string {
		return this.username || "Unknown";
	}

	public hasUsername(): boolean {
		return this.username !== null;
	}

	public cleanup(): void {
		this.hideUsernameForm();
	}
}
