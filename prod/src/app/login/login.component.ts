// src/app/login/login.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, LoginCredentials } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  flipped = false;
  loading = false;
  loginType: 'admin' | 'user' = 'admin';
  errorMessage: string = '';
  particles: any[] = [];
  currentInputField: string = 'email';
  numpadValue: string = '';

  // 🎯 NOUVEAU FLAG : savoir si l'utilisateur a modifié le mot de passe manuellement
  private passwordManuallyEdited = false;

  loginForm = {
    nom: '',
    password: '',
    errors: { nom: '', password: '' }
  };

  registerForm = {
    firstName: '',
    lastName: '',
    nom: '',
    password: '',
    confirm: '',
    errors: { firstName: '', lastName: '', nom: '', password: '', confirm: '' }
  };

  numpadButtons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '⌫', '0', '✓'
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  private isNumericInput(value: string): boolean {
    return /^\d*$/.test(value);
  }

  validateLogin(): boolean {
    let isValid = true;
    this.loginForm.errors = { nom: '', password: '' };
    this.errorMessage = '';

    if (!this.loginForm.nom) {
      this.loginForm.errors.nom = 'Matricule requis';
      isValid = false;
    } else if (!this.isNumericInput(this.loginForm.nom)) {
      this.loginForm.errors.nom = 'Uniquement des chiffres autorisés';
      isValid = false;
    } else if (this.loginForm.nom.length < 4) {
      this.loginForm.errors.nom = 'Minimum 4 chiffres';
      isValid = false;
    }

    if (!this.loginForm.password) {
      this.loginForm.errors.password = 'Mot de passe requis';
      isValid = false;
    } else if (!this.isNumericInput(this.loginForm.password)) {
      this.loginForm.errors.password = 'Uniquement des chiffres autorisés';
      isValid = false;
    } else if (this.loginForm.password.length < 4) {
      this.loginForm.errors.password = 'Minimum 4 chiffres';
      isValid = false;
    }

    return isValid;
  }

  validateRegister(): boolean {
    let isValid = true;
    this.registerForm.errors = { firstName: '', lastName: '', nom: '', password: '', confirm: '' };
    this.errorMessage = '';

    if (!this.registerForm.firstName) {
      this.registerForm.errors.firstName = 'Prénom requis';
      isValid = false;
    }

    if (!this.registerForm.lastName) {
      this.registerForm.errors.lastName = 'Nom requis';
      isValid = false;
    }

    if (!this.registerForm.nom) {
      this.registerForm.errors.nom = 'Matricule requis';
      isValid = false;
    } else if (!this.isNumericInput(this.registerForm.nom)) {
      this.registerForm.errors.nom = 'Uniquement des chiffres autorisés';
      isValid = false;
    } else if (this.registerForm.nom.length < 4) {
      this.registerForm.errors.nom = 'Minimum 4 chiffres';
      isValid = false;
    }

    if (!this.registerForm.password) {
      this.registerForm.errors.password = 'Mot de passe requis';
      isValid = false;
    } else if (!this.isNumericInput(this.registerForm.password)) {
      this.registerForm.errors.password = 'Uniquement des chiffres autorisés';
      isValid = false;
    } else if (this.registerForm.password.length < 4) {
      this.registerForm.errors.password = 'Minimum 4 chiffres';
      isValid = false;
    }

    if (this.registerForm.password !== this.registerForm.confirm) {
      this.registerForm.errors.confirm = 'Les mots de passe ne correspondent pas';
      isValid = false;
    }

    return isValid;
  }

  ngOnInit() {
    this.createParticles();

    if (this.authService.isLoggedIn()) {
      const userType = this.authService.getUserType();
      if (userType === 'admin') {
        this.router.navigate(['/prod']);
      } else {
        this.router.navigate(['/choix']);
      }
    }
  }

  ngOnDestroy() {
    this.particles = [];
  }

  createParticles() {
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        left: Math.random() * 100 + '%',
        animationDelay: Math.random() * 15 + 's',
        size: Math.random() * 4 + 2 + 'px',
        opacity: Math.random() * 0.5 + 0.2
      });
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const key = event.key;

    if (this.isNumericKey(key) || key === 'Backspace' || key === 'Delete' || key === 'Enter') {
      event.preventDefault();
    }

    if (this.isNumericKey(key)) {
      this.onNumpadButtonClick(key);
    }
    else if (key === 'Backspace' || key === 'Delete') {
      this.onNumpadButtonClick('⌫');
    }
    else if (key === 'Enter') {
      this.onNumpadButtonClick('✓');
    }
  }

  private isNumericKey(key: string): boolean {
    return /^[0-9]$/.test(key);
  }

  toggleFlip() {
    this.flipped = !this.flipped;
    this.clearErrors();
    this.currentInputField = this.flipped ? 'firstName' : 'email';
    this.numpadValue = this.getCurrentFieldValue();
  }

  toggleLoginType(type: 'admin' | 'user') {
    this.loginType = type;
    this.clearErrors();
  }

  clearErrors() {
    this.loginForm.errors = { nom: '', password: '' };
    this.registerForm.errors = { firstName: '', lastName: '', nom: '', password: '', confirm: '' };
    this.errorMessage = '';
  }

  openNumpad(field: string) {
    // 🎯 Quand l'utilisateur clique sur le champ mot de passe → il veut le modifier manuellement
    if (field === 'password' && this.currentInputField !== 'password') {
      this.passwordManuallyEdited = true;
      // On remet le numpad à zéro pour qu'il puisse entrer un nouveau mot de passe
      this.numpadValue = '';
      this.loginForm.password = '';
    }
    this.currentInputField = field;
    // Si le champ password vient d'être réinitialisé, on affiche vide
    if (field === 'password' && this.passwordManuallyEdited) {
      this.numpadValue = '';
    } else {
      this.numpadValue = this.getCurrentFieldValue();
    }
  }

  getCurrentFieldValue(): string {
    switch (this.currentInputField) {
      case 'email':
        return this.loginForm.nom;
      case 'password':
        return this.loginForm.password;
      case 'firstName':
        return this.registerForm.firstName;
      case 'lastName':
        return this.registerForm.lastName;
      case 'registerEmail':
        return this.registerForm.nom;
      case 'registerPassword':
        return this.registerForm.password;
      case 'confirmPassword':
        return this.registerForm.confirm;
      default:
        return '';
    }
  }

  setCurrentFieldValue(value: string) {
    switch (this.currentInputField) {
      case 'email':
        this.loginForm.nom = value;
        // 🎯 Copie automatique dans le mot de passe SEULEMENT si l'utilisateur
        // n'a pas encore modifié le mot de passe manuellement
        if (!this.passwordManuallyEdited) {
          this.loginForm.password = value;
        }
        break;

      case 'password':
        // 🎯 L'utilisateur saisit librement son mot de passe
        this.loginForm.password = value;
        break;

      case 'firstName':
        this.registerForm.firstName = value;
        break;
      case 'lastName':
        this.registerForm.lastName = value;
        break;
      case 'registerEmail':
        this.registerForm.nom = value;
        break;
      case 'registerPassword':
        this.registerForm.password = value;
        break;
      case 'confirmPassword':
        this.registerForm.confirm = value;
        break;
    }
  }

onNumpadButtonClick(button: string) {
  if (button === '⌫') {
    this.numpadValue = this.numpadValue.slice(0, -1);
  } else if (button === '✓') {
    this.setCurrentFieldValue(this.numpadValue);

    const isLastField = this.flipped ?
      this.currentInputField === 'confirmPassword' :
      this.currentInputField === 'password';

    if (isLastField) {
      if (this.flipped) {
        this.onRegister();
      } else {
        this.onLogin();
      }
    } else {
      this.goToNextField();
    }
  } else {
    this.numpadValue += button;
  }
  
  // Mettre à jour la valeur du champ
  this.setCurrentFieldValue(this.numpadValue);
  
  // Si c'est un champ de mot de passe, l'afficheur montrera automatiquement des points
  // grâce à la méthode maskPassword() dans le template
}
  goToNextField() {
    const fields = this.flipped ?
      ['firstName', 'lastName', 'registerEmail', 'registerPassword', 'confirmPassword'] :
      ['email', 'password'];

    const currentIndex = fields.indexOf(this.currentInputField);

    if (currentIndex < fields.length - 1) {
      // 🎯 Quand on passe automatiquement du matricule au mot de passe (via ✓),
      // on ne considère PAS ça comme une édition manuelle → la copie auto reste
      const nextField = fields[currentIndex + 1];
      if (nextField === 'password') {
        // Passage automatique : le mot de passe reste synchronisé avec le matricule
        this.passwordManuallyEdited = false;
        this.currentInputField = nextField;
        this.numpadValue = this.loginForm.password; // Afficher la valeur pré-remplie
      } else {
        this.openNumpad(nextField);
      }
    }
  }

  onLogin() {
    // 🎯 Reset du flag pour la prochaine connexion
    this.passwordManuallyEdited = false;

    if (this.validateLogin()) {
      this.loading = true;
      this.errorMessage = '';

      const credentials: LoginCredentials = {
        nom: this.loginForm.nom,
        password: this.loginForm.password
      };

      if (this.loginType === 'admin') {
        this.authService.adminLogin(credentials).subscribe({
          next: () => {
            this.loading = false;
          },
          error: (error) => {
            this.loading = false;
            if (error.status === 401) {
              this.errorMessage = 'Matricule ou mot de passe incorrect';
            } else if (error.error?.message) {
              this.errorMessage = error.error.message;
            } else {
              this.errorMessage = 'Erreur de connexion. Veuillez réessayer.';
            }
            console.error('Login error:', error);
          }
        });
      } else {
        this.authService.userLogin(credentials).subscribe({
          next: () => {
            this.loading = false;
          },
          error: (error) => {
            this.loading = false;
            if (error.status === 401) {
              this.errorMessage = 'Matricule ou mot de passe incorrect';
            } else if (error.error?.message) {
              this.errorMessage = error.error.message;
            } else {
              this.errorMessage = 'Erreur de connexion. Veuillez réessayer.';
            }
            console.error('Login error:', error);
          }
        });
      }
    }
  }

  onRegister() {
    if (this.validateRegister()) {
      this.loading = true;
      this.errorMessage = '';

      const registerData = {
        nom: this.registerForm.nom,
        prenom: this.registerForm.firstName + ' ' + this.registerForm.lastName,
        password: this.registerForm.password
      };

      this.authService.registerAdmin(registerData).subscribe({
        next: (response) => {
          this.loading = false;
          alert('Admin créé avec succès! Vous pouvez maintenant vous connecter.');
          this.toggleFlip();
          this.loginForm.nom = this.registerForm.nom;
          this.loginType = 'admin';
        },
        error: (error) => {
          this.loading = false;
          if (error.status === 409) {
            this.errorMessage = 'Un admin avec ce matricule existe déjà';
          } else if (error.error?.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Erreur lors de l\'inscription. Veuillez réessayer.';
          }
          console.error('Register error:', error);
        }
      });
    }
  }

  isFlipped() {
    return this.flipped;
  }

  getCurrentFieldName(): string {
    const fieldNames: { [key: string]: string } = {
      'email': 'Matricule',
      'password': 'Mot de passe',
      'firstName': 'Prénom',
      'lastName': 'Nom',
      'registerEmail': 'Matricule',
      'registerPassword': 'Mot de passe',
      'confirmPassword': 'Confirmation'
    };
    return fieldNames[this.currentInputField] || 'Champ';
  }
  // src/app/login/login.component.ts
// Ajoutez ces méthodes dans la classe LoginComponent

/**
 * Vérifie si le champ actuel est un champ de mot de passe
 */
isPasswordField(): boolean {
  const passwordFields = ['password', 'registerPassword', 'confirmPassword'];
  return passwordFields.includes(this.currentInputField);
}

/**
 * Masque le mot de passe avec des points
 */
maskPassword(value: string): string {
  if (!value) return '';
  // Remplacer chaque caractère par un point
  return '•'.repeat(value.length);
}
}