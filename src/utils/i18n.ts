export type Language = 'en' | 'id';

export interface Dictionary {
  toolbar: {
    lightMode: string;
    darkMode: string;
  };
  nav: {
    languageLabel: string;
  };
  public3d: {
    backToHome: string;
    signInBtn: string;
    guestUploadHint: string;
    authLaunchTitle: string;
    authLaunchSub: string;
    authLaunchBtn: string;
  };
}

const dict: Record<Language, Dictionary> = {
  en: {
    toolbar: {
      lightMode: 'Light mode',
      darkMode: 'Dark mode',
    },
    nav: {
      languageLabel: 'Language',
    },
    public3d: {
      backToHome: 'Back to Home',
      signInBtn: 'Open Main App',
      guestUploadHint:
        'Upload a .FIT or .GPX file to start, or use the sample track. No account required.',
      authLaunchTitle: 'Studio 3D',
      authLaunchSub:
        'Visualize any .FIT or .GPX run on a 3D map with custom .GLB avatars — no account required.',
      authLaunchBtn: 'Open Studio 3D',
    },
  },
  id: {
    toolbar: {
      lightMode: 'Mode Terang',
      darkMode: 'Mode Gelap',
    },
    nav: {
      languageLabel: 'Bahasa',
    },
    public3d: {
      backToHome: 'Kembali ke Beranda',
      signInBtn: 'Buka Aplikasi Utama',
      guestUploadHint:
        'Unggah file .FIT atau .GPX untuk mulai, atau pakai sample track. Tidak perlu akun.',
      authLaunchTitle: 'Studio 3D',
      authLaunchSub:
        'Visualisasi lari dari .FIT / .GPX di peta 3D dengan avatar .GLB custom — tanpa akun.',
      authLaunchBtn: 'Buka Studio 3D',
    },
  },
};

export function getTranslations(lang: Language): Dictionary {
  return dict[lang] ?? dict.id;
}
