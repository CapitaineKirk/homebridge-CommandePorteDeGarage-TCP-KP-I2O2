var Service;
var Characteristic;
var net = require('net');

const TCP_PORT = 12345;

const TCP_CMD_CAPTEUR_1 ="AT+OCCH1=?\r\n";
const TCP_ETAT_CAPTEUR_1_ON ="+OCCH1:1\r\n";
const TCP_ETAT_CAPTEUR_1_OFF ="+OCCH1:0\r\n";

const TCP_CMD_CAPTEUR_2 ="AT+OCCH2=?\r\n";
const TCP_ETAT_CAPTEUR_2_ON ="+OCCH2:1\r\n";
const TCP_ETAT_CAPTEUR_2_OFF ="+OCCH2:0\r\n";

const TCP_CMD_ACTIONNEUR_1 ="AT+STACH1=1,1\r\n";
const TCP_ETAT_ACTIONNEUR_1 ="OK\r\n";

const TCP_CMD_ACTIONNEUR_2 ="AT+STACH2=1,1\r\n";
const TCP_ETAT_ACTIONNEUR_2 ="OK\r\n";

const TCP_TIMEOUT = 500;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-CommandePorteDeGarage-TCP-KP-I2O2', 'CommandePorteDeGarage-TCP-KP-I2O2', PorteDeGarageAccessory);
};

function PorteDeGarageAccessory(log, config) {
  this.log = log;
  this.name = config.name;
  this.adresseIp = config.adresseIp;
  switch(config.capteurFerme) {
    case 1:
      this.commandeCapteurFerme = TCP_CMD_CAPTEUR_1;
      this.etatCapteurFermeOn = TCP_ETAT_CAPTEUR_1_ON;
      this.etatCapteurFermeOff = TCP_ETAT_CAPTEUR_1_OFF;
    break;
    case 2:
      this.commandeCapteurFerme = TCP_CMD_CAPTEUR_2;
      this.etatCapteurFermeOn = TCP_ETAT_CAPTEUR_2_ON;
      this.etatCapteurFermeOff = TCP_ETAT_CAPTEUR_2_OFF;
    break;
  }
  switch(config.capteurOuvert) {
    case 1:
      this.commandeCapteurOuvert = TCP_CMD_CAPTEUR_1;
      this.etatCapteurOuvertOn = TCP_ETAT_CAPTEUR_1_ON;
      this.etatCapteurOuvertOff = TCP_ETAT_CAPTEUR_1_OFF;
    break;
    case 2:
      this.commandeCapteurOuvert = TCP_CMD_CAPTEUR_2;
      this.etatCapteurOuvertOn = TCP_ETAT_CAPTEUR_2_ON;
      this.etatCapteurOuvertOff = TCP_ETAT_CAPTEUR_2_OFF;
    break;
  }
  switch(config.actionneurPorte) {
    case 1:
      this.commandeActionneurPorte  = TCP_CMD_ACTIONNEUR_1;
      this.etatActionneurPorte = TCP_ETAT_ACTIONNEUR_1;
    break;
    case 2:
      this.commandeActionneurPorte  = TCP_CMD_ACTIONNEUR_2;
      this.etatActionneurPorte = TCP_ETAT_ACTIONNEUR_2;
    break;
  }
  this.intervalLecture = config.intervalLecture || 1;
  this.debug = config.debug || 0;
  this.etatPorteActuel = Characteristic.CurrentDoorState.CLOSED; //Etat initial
  this.etatPorteDemande = Characteristic.TargetDoorState.CLOSED; //Etat initial
  this.etatPorteObstruction = false; //Etat initial
  this.etatCapteurFerme = false;
  this.etatCapteurOuvert = false;
  this.horodatageMouvement = 0;
  this.horodatageCommande = 0;
  this.log('Fin PorteDeGarageAccessory');
}

PorteDeGarageAccessory.prototype.setStateDemande = function(estFerme, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;
  var etatDemande = estFerme ? 'close' : 'open';

  accessory.log('Appel de setStateDemande : etat = ' + etatDemande + ', context = ' + context);

  if(etatDemande == 'open') {
    accessory.etatPorteDemande = Characteristic.TargetDoorState.OPEN;
  }
  if(etatDemande == 'close') {
    accessory.etatPorteDemande = Characteristic.TargetDoorState.CLOSED;
  }

  callback();
  return true;
};

PorteDeGarageAccessory.prototype.getStateActuel = function(callback) {
  var accessory = this;

  accessory.log('Appel de getStateActuel : etat = ' + accessory.etatPorteActuel);

  callback(null, accessory.etatPorteActuel);
}

PorteDeGarageAccessory.prototype.getStateDemande = function(callback) {
  var accessory = this;

  accessory.log('Appel de getStateDemande : etat = ' + accessory.etatPorteDemande);

  callback(null, accessory.etatPorteDemande);
}

PorteDeGarageAccessory.prototype.getStateObstruction = function(callback) {
  var accessory = this;

  accessory.log('Appel de getStateObstruction : etat = ' + accessory.etatPorteObstruction);

  callback(null, accessory.etatPorteObstruction);
}

PorteDeGarageAccessory.prototype.gererEvenementConnect = function() {
  this.log('Evenement connexion');
  if (this.stateTimer) {
    clearTimeout(this.stateTimer);
    this.stateTimer = null;
  }
  this.commandeEnCours = '';
  this.stateTimer = setImmediate(this.interrogerEtat.bind(this));
}

PorteDeGarageAccessory.prototype.gererEvenementTimeout = function() {
  this.log('Evenement timeout');
  this.socket.connect(TCP_PORT, this.adresseIp);
}

PorteDeGarageAccessory.prototype.gererEvenementError = function(error) {
  this.log('Evenement error (' + error.code + ')');
}

PorteDeGarageAccessory.prototype.gererEvenementClose = function() {
  this.log('Evenement close');
  this.socket.connect(TCP_PORT, this.adresseIp);
}

PorteDeGarageAccessory.prototype.gererEvenementData = function(data) {
  if(this.debug) {
    this.log('Evenement data : ' + data);
  }

  try {
    this.lectureCapteur = data.toString('utf-8');
  } catch(exception) {
    this.log("Erreur lecture de l'etat :" + exception.sdout);
    this.lectureCapteur = '';
  }
  if(this.debug) {
    this.log('Donnees : ' + this.lectureCapteur);
  }
  if (this.stateTimer) {
    clearTimeout(this.stateTimer);
    this.stateTimer = null;
  }
  this.stateTimer = setImmediate(this.interrogerEtat.bind(this));
}
  
PorteDeGarageAccessory.prototype.gererEvenementEnd = function() {
    this.log('Evenement end');
}

PorteDeGarageAccessory.prototype.interrogerEtat = function() {
  if(this.debug) {
    this.log('Interrogation du capteur avec la commande ' + this.commandeEnCours);
  }
  // en fonction de la commande executee on definit la prochaine commande a executer
  switch(this.commandeEnCours) {
    case '' :
      this.lectureCapteurFerme = ''
      this.lectureCapteurOuvert = '';
      this.retourCommande = '';
      this.commandeEnCours = this.commandeCapteurFerme;
      if(this.debug) {
        this.log('Pas de commande en cours, la prochaine commande sera l\'interrogation du CapteurFerme');
      }
    break;
    case this.commandeCapteurFerme :
      this.lectureCapteurFerme = this.lectureCapteur;
      this.commandeEnCours = this.commandeCapteurOuvert;
      if(this.debug) {
        this.log('Commande en cours pour le CapteurFerme, la prochaine commande sera l\'interrogation du CapteurOuvert');
      }
    break;
    case this.commandeCapteurOuvert :
      this.lectureCapteurOuvert = this.lectureCapteur;
      this.commandeEnCours = '';
      if(this.debug) {
        this.log('Commande en cours pour le CapteurOuvert, pas de prochaine commande');
      }
    break;
    case this.commandeActionneurPorte :
      this.retourCommande = this.lectureCapteur;
      this.commandeEnCours = '';
      if(this.debug) {
        this.log('Commande en cours pour l\'ActionneurPorte, pas de prochaine commande');
      }
    break;
  }
  // execution de la commande a executer
  switch(this.commandeEnCours) {
    case '' :
    case this.commandeActionneurPorte :
      if (this.stateTimer) {
        clearTimeout(this.stateTimer);
        this.stateTimer = null;
      }
      this.stateTimer = setImmediate(this.gererEtat.bind(this));
    break;
    case this.commandeCapteurFerme :
    case this.commandeCapteurOuvert :
      if(!this.socket.write(this.commandeEnCours)){
        if(this.debug) {
          this.log('Interrogation ratee avec ' + this.commandeEnCours);
        }
      } else {
        if(this.debug) {
          this.log('Interrogation reussie avec ' + this.commandeEnCours);
        }
      }
    break;
  }
}

PorteDeGarageAccessory.prototype.gererEtat = function() {
  var accessory = this;
  var horodatageGestionEtat = Date.now();
  var changeEtatActuel = false;
  var changeEtatDemande = false;
  var changeEtatObstruction = false;
  var activerCommande = false;

  if(accessory.debug) {
    accessory.log('Etat demande      : ' + accessory.etatPorteDemande);
    accessory.log('Etat actuel       : ' + accessory.etatPorteActuel);
    accessory.log('Etat obstruction  : ' + accessory.etatPorteObstruction);
  }

  if(accessory.debug) {
    accessory.log('Etat du capteur CapteurOuvert de ' + accessory.name + ' (ON) = ' + accessory.etatCapteurOuvertOn);
    accessory.log('Etat du capteur CapteurOuvert de ' + accessory.name + ' (OFF) = ' + accessory.etatCapteurOuvertOff);
  }
  switch(accessory.lectureCapteurOuvert) {
    case accessory.etatCapteurOuvertOn :
      accessory.etatCapteurOuvert = true;
      if(accessory.debug) {
        accessory.log('Etat du capteur CapteurOuvert de ' + accessory.name + ' est (ON) : ' + accessory.lectureCapteurOuvert);
      }
    break;
    case accessory.etatCapteurOuvertOff :
      accessory.etatCapteurOuvert = false;
      if(accessory.debug) {
        accessory.log('Etat du capteur CapteurOuvert de ' + accessory.name + ' est (OFF) : ' + accessory.lectureCapteurOuvert);
      }
    break;
    default :
      accessory.log('Réception message inconnu lors de l\'interrogation du capteurOuvert de ' + accessory.name + ' : ' + accessory.lectureCapteurOuvert);
    break;
  }

  if(accessory.debug) {
    accessory.log('Etat du capteur CapteurFerme de ' + accessory.name + ' (ON) = ' + accessory.etatCapteurFermeOn);
    accessory.log('Etat du capteur CapteurFerme de ' + accessory.name + ' (OFF) = ' + accessory.etatCapteurFermeOff);
  }
  switch(accessory.lectureCapteurFerme) {
    case accessory.etatCapteurFermeOn :
      accessory.etatCapteurFerme = true;
      if(accessory.debug) {
        accessory.log('Etat du capteurFerme de ' + accessory.name + ' est (ON) : ' + accessory.lectureCapteurFerme);
      }
    break;
    case accessory.etatCapteurFermeOff :
      accessory.etatCapteurFerme = false;
      if(accessory.debug) {
        accessory.log('Etat du capteurFerme de ' + accessory.name + ' est (OFF) : ' + accessory.lectureCapteurFerme);
      }
    break;
    default :
      accessory.log('Réception message inconnu lors de l\'interrogation du capteurFerme de ' + accessory.name + ' : ' + accessory.lectureCapteurFerme);
    break;
  }
  switch(accessory.retourCommande) {
    case accessory.etatActionneurPorte :
      accessory.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState).updateValue(accessory.etatPorteActuel);
      accessory.log('Commande de l\'envoi d\'impulsion pour ' + accessory.name + ' terminee avec le statut  (OK)');
      accessory.horodatageCommande = Date.now();
    break;
    case '' :
      if(accessory.debug) {
        accessory.log('Pas de retour de la commande de l\'envoi d\'impulsion pour ' + accessory.name);
      }
    break;
    default :
      accessory.log('Réception message inconnu lors de l\'envoi d\'impulsion pour ' + accessory.name + ' : ' + accessory.retourCommande);
    break;
  }

  if(accessory.debug) {
    accessory.log('Etat du capteurOuvert de ' + accessory.name + ' est : ' + '(' + accessory.etatCapteurOuvert + ')');
    accessory.log('Etat du capteurFerme de ' + accessory.name + ' est : ' + '(' + accessory.etatCapteurFerme + ')');
  }

  // en fonction des etats des capteurs et de l'etat actuel, detection d'un mouvement de la porte
  if(!accessory.etatCapteurOuvert && !accessory.etatCapteurFerme) {
    if(accessory.etatPorteActuel == Characteristic.CurrentDoorState.OPEN) {
      // si les capteurs ouvert et ferme ne sont pas a vrai (donc la porte est entre les deux)
      // et que l'etat actuel de la porte est ouvert alors :
      // - l'etat actuel de la porte devient en fermeture
      // - l'etat demande de la porte est ferme
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.CLOSING;
      changeEtatActuel = true;
      accessory.log('Etat de ' + accessory.name + ' est : Fermeture');
      accessory.horodatageMouvement = Date.now();
      
      if(accessory.etatPorteDemande != Characteristic.TargetDoorState.CLOSED) {
        accessory.log('Demande de fermeture  de ' + accessory.name + ' par l\'interrupteur ou une télécommande');
        accessory.etatPorteDemande = Characteristic.TargetDoorState.CLOSED;
        changeEtatDemande = true;
      }
      if(accessory.horodatageCommande == 0) {
        // si il n'y a pas d'horodatage de la commande (donc action par telecommande  ou l'interrupteur) 
        accessory.horodatageCommande = accessory.horodatageMouvement;
      } else {
        // sinon la commande a ete activee par home => affichage du delai de reaction entre l'impulsion et 
        // le changement d'etat des capteurs
        accessory.log('Temps de réaction = ' + (horodatageGestionEtat - accessory.horodatageCommande)/1000 + ' s');
      }
      if(accessory.etatPorteObstruction) {
        // le capteur ouvert vient de passer a OFF alors que la porte etait precedement en position ouvert
        // donc la porte n'est plus dans l'etat d'obstruction
        accessory.log('Fin de l\'état d\'obstruction pour ' + accessory.name);
        accessory.etatPorteObstruction = false;
        changeEtatObstruction = true;
      }
    }
    if(accessory.etatPorteActuel == Characteristic.CurrentDoorState.CLOSED) {
      // si les capteurs ouvert et ferme ne sont pas a vrai (donc la porte est entre les deux)
      // et que l'etat actuel de la porte est ferme alors :
      // - l'etat actuel de la porte devient en ouverture
      // - l'etat demande de la porte est ouvert
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.OPENING;
      changeEtatActuel = true;
      accessory.log('Etat de ' + accessory.name + ' est : Ouverture');
      accessory.horodatageMouvement = Date.now();
      
      if(accessory.etatPorteDemande != Characteristic.TargetDoorState.OPEN) {
        accessory.log('Demande d\'ouverture  de ' + accessory.name + ' par l\'interrupteur ou une télécommande');
        accessory.etatPorteDemande = Characteristic.TargetDoorState.OPEN;
        changeEtatDemande = true;
      }
      if(accessory.horodatageCommande == 0) {
        // si il n'y a pas d'horodatage de la commande (donc action par telecommande  ou l'interrupteur) 
        accessory.horodatageCommande = accessory.horodatageMouvement;
      } else {
        // sinon la commande a ete activee par home => affichage du delai de reaction entre l'impulsion et 
        // le changement d'etat des capteurs
        accessory.log('Temps de réaction = ' + (horodatageGestionEtat - accessory.horodatageCommande)/1000 + ' s');
      }
      if(accessory.etatPorteObstruction) {
        // le capteur ferme vient de passer a OFF alors que la porte etait precedement en position ferme
        // donc la porte n'est plus dans l'etat d'obstruction
        accessory.log('Fin de l\'état d\'obstruction pour ' + accessory.name);
        accessory.etatPorteObstruction = false;
        changeEtatObstruction = true;
      }
    }
  }

  if(accessory.etatCapteurFerme) {
    if(accessory.etatPorteActuel != Characteristic.CurrentDoorState.CLOSED) {
      // si le capteur ferme est a vrai (donc la porte est fermee)
      // et que l'etat actuel de la porte n'est pas ferme alors :
      // - l'etat actuel de la porte devient en fermeture
      // - l'etat demande de la porte est ferme
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.CLOSED;
      accessory.etatPorteDemande = Characteristic.TargetDoorState.CLOSED;
      changeEtatDemande = true;
      changeEtatActuel = true;
      accessory.log('Etat de ' + accessory.name + ' est : Ferme');
      accessory.log('Temps de fermeture = ' + (horodatageGestionEtat - accessory.horodatageMouvement)/1000 + ' s');
      accessory.horodatageMouvement = 0;
      accessory.horodatageCommande = 0;
      
      if(accessory.etatPorteObstruction) {
        // le capteur ferme vient de passer a ON alors que la porte n'etait pas precedement en position ferme
        // donc la porte n'est plus dans l'etat d'obstruction
        accessory.log('Fin de l\'état d\'obstruction pour ' + accessory.name);
        accessory.etatPorteObstruction = false;
        changeEtatObstruction = true;
      }
    }
  }

  if(accessory.etatCapteurOuvert) {
    if(accessory.etatPorteActuel != Characteristic.CurrentDoorState.OPEN) {
      // si le capteur ouvert est a vrai (donc la porte est ouverte)
      // et que l'etat actuel de la porte n'est pas ouvert alors :
      // - l'etat actuel de la porte devient en ouverture
      // - l'etat demande de la porte est ouvert
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.OPEN;
      accessory.etatPorteDemande = Characteristic.CurrentDoorState.OPEN;
      changeEtatDemande = true;
      changeEtatActuel = true;
      accessory.log('Etat de ' + accessory.name + ' est : ouvert');
      accessory.log('Temps d\'ouverture = ' + (horodatageGestionEtat - accessory.horodatageMouvement)/1000 + ' s');
      accessory.horodatageMouvement = 0;
      accessory.horodatageCommande = 0;
      
      if(accessory.etatPorteObstruction) {
        // le capteur ouvert vient de passer a ON alors que la porte n'etait pas precedement en position ouverte 
        // donc la porte n'est plus dans l'etat d'obstruction
        accessory.log('Fin de l\'état d\'obstruction pour ' + accessory.name);
        accessory.etatPorteObstruction = false;
        changeEtatObstruction = true;
      }
    }
  }


  // en fonction de l'etat demande on detecte une demande d'ouverture/fermeture provenant de home
  // Pour la porte la commande est rudimentaire : une impulsion =>
  // Cas 1 : si la porte est fermee => la porte s'ouvre
  // Cas 2 : si la porte est ouverte => la porte se ferme
  // Cas 3 : si la porte est en train de se fermer => la porte s'arrete
  // Cas 4 : si la porte est en train de s'ouvrir => la porte s'arrete
  // Cas 5 : si la porte est arretee => elle s'ouvre si elle avait ete arretee en train de se fermer,
  //         ou se ferme si elle avait ete arretee en train de s'ouvrir
  switch(accessory.etatPorteDemande) {
    case Characteristic.TargetDoorState.OPEN :
      switch(accessory.etatPorteActuel) {
        case Characteristic.CurrentDoorState.CLOSED :
          // si l'etat demande est ouvert et que la porte est fermee
          // Il est inutile de changer l'etat actuel.
          
          if(accessory.horodatageCommande == 0) {
            // Si pas aucune commande n'a ete envoyee => Cas 1 : on active la commande
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvert, fermé) => une implusion');
            activerCommande = true;
          } else if ((horodatageGestionEtat - accessory.horodatageCommande) < 2000) {
            // Si une commande a deja ete envoyee depuis moins de 2 secondes, on attend
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvert, fermé), en attente de mouvement');
          } else {
            // Si une commande a deja ete envoyee depuis plus de 2 secondes, et que rien ne bouge, il y a un pb
            //   => on change l'etat demande a CLOSED (on annule la demande) et on passe en etat d'obstruction
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvert, fermé), pas de mouvement, on annule la demande');
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' deviennent : (fermé, ferméé) => obstruction');
            accessory.etatPorteDemande = Characteristic.TargetDoorState.CLOSED;
            changeEtatDemande = true;
            accessory.etatPorteObstruction = true;
            changeEtatObstruction = true;
            accessory.horodatageCommande = 0;
          }
        break;
        case Characteristic.CurrentDoorState.CLOSING : 
          // si l'etat demande est ouvert et que la porte est en train de se fermer
          // => Cas 3 : on active la commande
          // Il faut changer l'etat actuel de la porte de fermeture a stoppe
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvrir, en fermeture) => une impulsion');
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' deviennent : (ouvrir, stoppé');
          accessory.etatPorteActuel = Characteristic.CurrentDoorState.STOPPED;
          changeEtatActuel = true;
          activerCommande = true;
        break;
        case Characteristic.CurrentDoorState.OPENING :
          // si la demande est ferme et que la porte est en train de se fermer
          // on ne fait rien sauf si le delai est trop important
          if ((horodatageGestionEtat - accessory.horodatageMouvement) < 20000) {
            if(accessory.debug) {
              accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvrir, en ouverture) => rien');
            }
          } else {
            if(!accessory.etatPorteObstruction) {
              // la porte passe dans l'etat d'obstruction si elle ne l'est pas deja
              accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvrir, en ouverture) et delai depasse => obstruction');
              accessory.etatPorteObstruction = true;
              changeEtatObstruction = true;
              accessory.horodatageCommande = 0;
            }
          }
        break;
        case Characteristic.CurrentDoorState.OPEN :
          // si l'etat demande est ouvert et que la porte est ouverte
          // on ne fait rien
          if(accessory.debug) {
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvrir, ouvert) => rien');
          }
        break;
        case Characteristic.CurrentDoorState.STOPPED :
          // si l'etat demande est ouvert et que la porte est stoppee
          // => Cas 5 : on active la commande
          // Il faut changer l'etat actuel de la porte de stoppe a ouverture
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (ouvrir, stoppé) => une impulsion');
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' deviennent : (ouvrir, en ouverture)');
          accessory.etatPorteActuel = Characteristic.CurrentDoorState.OPENING;;
          changeEtatActuel = true;
          activerCommande = true;
        break;
      }
    break;
    case Characteristic.TargetDoorState.CLOSED : 
      switch(accessory.etatPorteActuel) {
        case Characteristic.CurrentDoorState.OPEN : 
          // si la demande est ferme et que la porte est ouverte
          // Il est inutile de changer l'etat actuel.
         
          if(accessory.horodatageCommande == 0) {
            // Si pas aucune commande n'a ete envoyee => Cas 1 : on active la commande
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, ouvert) => une implusion');
            activerCommande = true;
          } else if ((horodatageGestionEtat - accessory.horodatageCommande) < 2000) {
            // Si une commande a deja ete envoyee depuis moins de 2 secondes, on attend
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, ouvert), en attente de mouvement');
          } else {
            // Si une commande a deja ete envoyee depuis plus de 2 secondes, et que rien ne bouge, il y a un pb
            //   => on change l'etat demande a OPEN (on annule la demande) et on passe en etat d'obstruction
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, ouvert), pas de mouvement, on annule la demande');
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' deviennent : (ouvert, ouvert) => obstruction');
            accessory.etatPorteDemande = Characteristic.TargetDoorState.OPEN;
            changeEtatDemande = true;
            accessory.etatPorteObstruction = true;
            changeEtatObstruction = true;
            accessory.horodatageCommande = 0;
          }
        break;
        case Characteristic.CurrentDoorState.OPENING : 
          // si la demande est ferme et que la porte est en train de s'ouvrir
          // => Cas 4 : on active la commande
          // Il faut changer l'etat actuel de la porte de ouverture a stoppe
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, en ouverture) => une impulsion');
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' deviennent : (fermé, stoppé)');
          accessory.etatPorteActuel = Characteristic.CurrentDoorState.STOPPED;
          changeEtatActuel = true;
          activerCommande = true;
        break;
        case Characteristic.CurrentDoorState.CLOSING : 
          // si la demande est ferme et que la porte est en train de se fermer
          // on ne fait rien sauf si le delai est trop important
          if ((horodatageGestionEtat - accessory.horodatageMouvement) < 20000) {
            if(accessory.debug) {
              accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, en fermeture) => rien');
            }
          } else {
            if(!accessory.etatPorteObstruction) {
              // la porte passe dans l'etat d'obstruction si elle ne l'est pas deja
              accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, en fermeture) et délai depassé => obstruction');
              accessory.etatPorteObstruction = true;
              changeEtatObstruction = true;
              accessory.horodatageCommande = 0;
            }
          }
        break;
        case Characteristic.CurrentDoorState.CLOSED : 
          // si la demande est ferme et que la porte est fermee
          // on ne fait rien
          if(accessory.debug) {
            accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, fermé) => rien');
          }
        break;
        case Characteristic.CurrentDoorState.STOPPED : 
          // si la demande est ferme et que la porte est stoppee
          // => Cas 5 : on active la commande
          // Il faut changer l'etat actuel de la porte de stoppe a fermeture
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' sont : (fermé, stoppé) => une impulsion');
          accessory.log('Etat demandé et actuel de ' + accessory.name + ' deviennentt : (fermé, en fermeture) => une impulsion');
          accessory.etatPorteActuel = Characteristic.CurrentDoorState.CLOSING;;
          activerCommande = true;
        break;
      }
    break;
  }

  // mise a jour des etats dans home en fonction de ce qui vient d'etre calcule
  if(changeEtatDemande) {
    accessory.garageDoorService.getCharacteristic(Characteristic.TargetDoorState).updateValue(accessory.etatPorteDemande);
  }
  if(changeEtatActuel) {
    accessory.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState).updateValue(accessory.etatPorteActuel);
  }
  if(changeEtatObstruction) {
    accessory.garageDoorService.getCharacteristic(Characteristic.ObstructionDetected).updateValue(accessory.etatPorteObstruction);
  }

  if(activerCommande) {
    if((accessory.horodatageCommande == 0) || ((horodatageGestionEtat - accessory.horodatageCommande) > 1500) ) {
      accessory.log('Commande envoyée : ' + accessory.commandeActionneurPorte);
      accessory.commandeEnCours = accessory.commandeActionneurPorte;
      try {
        accessory.socket.write(accessory.commandeActionneurPorte);
      } catch(exception) {
        accessory.log("Erreur d\'exécution de la commande : " + exception.sdout);
      accessory.commandeEncours = '';
      }
    } else {
      accessory.log('La commande envoyée, il y a ' + (horodatageGestionEtat - accessory.horodatageCommande)/1000  + ' s, pas de commande réenvoyée');
    }
  }

  if(accessory.debug) {
    accessory.log('Relance de interrogerEtat dans ' + accessory.intervalLecture + 's');
  }
  // Clear any existing timer
  if (accessory.stateTimer) {
    clearTimeout(accessory.stateTimer)
    accessory.stateTimer = null;
  }
  accessory.stateTimer = setTimeout(this.interrogerEtat.bind(this), accessory.intervalLecture * 1000);
};

PorteDeGarageAccessory.prototype.getServices = function() {
  this.log('Debut Getservices');
  this.informationService = new Service.AccessoryInformation();
  this.garageDoorService = new Service.GarageDoorOpener(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Fabrique du Capitaine Kirk')
  .setCharacteristic(Characteristic.Model, 'Porte de garage')
  .setCharacteristic(Characteristic.SerialNumber, '1.0.0');

  this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
  .on('set', this.setStateDemande.bind(this))
  .on('get', this.getStateDemande.bind(this))
  .updateValue(this.etatPorteDemande);

  this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
  .on('get', this.getStateActuel.bind(this))
  .updateValue(this.etatPorteActuel);

  this.garageDoorService.getCharacteristic(Characteristic.ObstructionDetected)
  .on('get', this.getStateObstruction.bind(this))
  .updateValue(this.etatPorteObstruction);

  this.socket = new net.Socket();
  this.socket.setTimeout(TCP_TIMEOUT);
  this.socket.on('connect',this.gererEvenementConnect.bind(this))
  this.socket.on('timeout',this.gererEvenementTimeout.bind(this))
  this.socket.on('error',this.gererEvenementError.bind(this))
  this.socket.on('close',this.gererEvenementClose.bind(this))
  this.socket.on('data',this.gererEvenementData.bind(this))
  this.socket.on('end',this.gererEvenementEnd.bind(this))

  this.log('Connexion a ' + this.adresseIp);
  this.socket.connect(TCP_PORT, this.adresseIp);

  this.stateTimer = setTimeout(this.interrogerEtat.bind(this),this.intervalLecture * 1000);

  return [this.informationService, this.garageDoorService];
};
