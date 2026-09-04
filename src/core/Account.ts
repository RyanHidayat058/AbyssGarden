export interface DiverProfile {
  id: string;
  name: string;
  avatarIcon: string;
  rank: string;
  createdAt: string;
  totalShellsEarned: number;
  totalHarvests: number;
}

const STORAGE_KEY_CURRENT_DIVER = 'abyss_garden_current_diver';
const STORAGE_KEY_PROFILES = 'abyss_garden_profiles';

export class AccountManager {
  public currentProfile: DiverProfile;
  public allProfiles: DiverProfile[] = [];

  constructor() {
    this.allProfiles = this.loadAllProfiles();
    this.currentProfile = this.loadCurrentProfile();
  }

  private loadAllProfiles(): DiverProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (data) return JSON.parse(data);
    } catch {
      // Fallback if localStorage unavailable
    }
    return [];
  }

  private loadCurrentProfile(): DiverProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CURRENT_DIVER);
      if (data) return JSON.parse(data);
    } catch {
      // Fallback
    }

    // Default profile
    const defaultProfile: DiverProfile = {
      id: 'diver_' + Date.now(),
      name: 'Aquanaut Ryan',
      avatarIcon: '🤿',
      rank: 'Reef Pioneer (Rank 1)',
      createdAt: new Date().toLocaleDateString(),
      totalShellsEarned: 50,
      totalHarvests: 0
    };
    this.saveCurrentProfile(defaultProfile);
    return defaultProfile;
  }

  public saveCurrentProfile(profile: DiverProfile) {
    this.currentProfile = profile;
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_DIVER, JSON.stringify(profile));

      // Update in all profiles list
      const idx = this.allProfiles.findIndex(p => p.id === profile.id);
      if (idx >= 0) {
        this.allProfiles[idx] = profile;
      } else {
        this.allProfiles.push(profile);
      }
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(this.allProfiles));
    } catch {
      // Fallback
    }
  }

  public updateStats(shellsEarnedDelta: number, harvestsDelta: number) {
    this.currentProfile.totalShellsEarned += shellsEarnedDelta;
    this.currentProfile.totalHarvests += harvestsDelta;

    // Calculate Rank
    if (this.currentProfile.totalHarvests >= 30) {
      this.currentProfile.rank = 'Abyssal Sovereign (Rank 5)';
    } else if (this.currentProfile.totalHarvests >= 15) {
      this.currentProfile.rank = 'Trench Master (Rank 4)';
    } else if (this.currentProfile.totalHarvests >= 8) {
      this.currentProfile.rank = 'Bioluminescent Cultivator (Rank 3)';
    } else if (this.currentProfile.totalHarvests >= 3) {
      this.currentProfile.rank = 'Deep Diver (Rank 2)';
    } else {
      this.currentProfile.rank = 'Reef Pioneer (Rank 1)';
    }

    this.saveCurrentProfile(this.currentProfile);
  }

  public setDiverName(newName: string) {
    if (newName.trim()) {
      this.currentProfile.name = newName.trim();
      this.saveCurrentProfile(this.currentProfile);
    }
  }

  public logout() {
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_DIVER);
    } catch {
      // Fallback
    }
  }

  public createNewDiver(name: string, avatar: string = '🤿'): DiverProfile {
    const newProfile: DiverProfile = {
      id: 'diver_' + Date.now(),
      name: name.trim() || 'Subsea Explorer',
      avatarIcon: avatar,
      rank: 'Reef Pioneer (Rank 1)',
      createdAt: new Date().toLocaleDateString(),
      totalShellsEarned: 50,
      totalHarvests: 0
    };
    this.saveCurrentProfile(newProfile);
    return newProfile;
  }
}
