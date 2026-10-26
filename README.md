# eRH App Mobile — Employer

Application mobile React Native (Expo) pour la gestion des ressources humaines côté employeur.

## Fonctionnalités

- **Authentification** : Connexion sécurisée JWT avec rafraîchissement automatique du token
- **Tableau de bord** : Vue d'ensemble (employés actifs, présences, congés en attente)
- **Employés** : Liste, recherche, filtres (actifs/sortis/tous), détail de chaque employé, marquer sortie / réintégration
- **Présences** : Suivi journalier et mensuel des pointages
- **Congés** : Gestion des demandes de congés (approuver / rejeter)
- **Profil** : Informations utilisateur, changement de mot de passe

## Stack technique

- **React Native** avec Expo SDK 52
- **TypeScript**
- **React Navigation** (Stack + Bottom Tabs)
- **Axios** avec gestion automatique du refresh token (JWT)
- **Expo SecureStore** pour le stockage sécurisé des tokens
- **React Native Paper** pour les composants UI
- **date-fns** pour la manipulation des dates

## Connexion au backend

L'application se connecte au même backend Django que la plateforme web :

```
# .env
EXPO_PUBLIC_API_URL=http://<IP_DU_SERVEUR>:8000
```

> Pour Android Emulator : `http://10.0.2.2:8000`
> Pour iOS Simulator : `http://localhost:8000`
> Pour un appareil physique : utilisez l'IP de votre machine sur le réseau local

## Installation

```bash
npm install
npx expo start
```

## Structure du projet

```
src/
├── api/          # Client Axios avec intercepteurs JWT
├── contexts/     # AuthContext
├── navigation/   # AppNavigator, AuthNavigator, MainNavigator
├── screens/      # Écrans de l'application
│   ├── auth/         # LoginScreen, ChangePasswordScreen
│   ├── employees/    # EmployeesScreen, EmployeeDetailScreen
│   ├── attendance/   # AttendanceScreen
│   ├── leaves/       # LeavesScreen
│   ├── DashboardScreen
│   └── ProfileScreen
├── services/     # Appels API (authService, employeeService, attendanceService, leaveService)
├── types/        # Types TypeScript (employee, attendance, leave, auth)
└── theme.ts      # Couleurs et thème de l'app
```

## Version iOS (iPhone)

Le code est le même pour Android et iOS. Le bundle iOS compile (`npx expo export --platform ios`).
Une version installable sur iPhone demande un **compte Apple Developer** (99 $/an) : c'est une règle d'Apple.

### 1. TestFlight (recommandé : un lien à envoyer aux testeurs)
```bash
npm install
npx eas-cli login
npx eas-cli build --platform ios --profile production     # Apple demande le compte Developer, EAS gère les certificats
npx eas-cli submit --platform ios --latest                # envoie le build dans App Store Connect › TestFlight
```
Dans App Store Connect › TestFlight : ajoutez les testeurs (internes ou par lien public). Ils installent l'app **TestFlight**
depuis l'App Store, ouvrent le lien d'invitation, puis appuient sur **Installer**.

### 2. Installation directe sur des iPhone enregistrés (sans TestFlight)
```bash
npx eas-cli device:create                                  # envoie le lien d'enregistrement aux iPhone (UDID)
npx eas-cli build --platform ios --profile ios-internal
```
EAS fournit un lien d'installation, valable pour les iPhone enregistrés seulement.

### 3. Simulateur iOS (Mac avec Xcode, sans compte Apple)
```bash
npx eas-cli build --platform ios --profile ios-simulator
```

Identifiant de l'app : `com.camusat.erh.mobile` — à créer dans App Store Connect avec le même identifiant.
Le numéro de build iOS s'incrémente automatiquement à chaque build `production`.
