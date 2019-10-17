var Service;
var Characteristic;
var execSync = require('child_process').execSync;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-garagedoorCommande', 'GarageCommande', GarageCmdAccessory);
};

function GarageCmdAccessory(log, config) {
  this.log = log;
  this.name = config.name;
  this.envoyerCommande = config.envoyerCommande;
  this.lireCapteurEtatOuvert = config.lireCapteurEtatOuvert;
  this.lireCapteurEtatFerme = config.lireCapteurEtatFerme;
  this.delaiMouvement = config.delaiMouvement || 15;
  this.intervalLecture = config.intervalLecture || 1;
  this.etatPorteActuel = Characteristic.CurrentDoorState.CLOSED; //Etat initial
  this.etatPorteDemande = Characteristic.TargetDoorState.CLOSED; //Etat initial
  this.capteurEtatFerme = false;
  this.capteurEtatOuvert = false;
  this.log('Fin GarageCmdAccessory');
}

GarageCmdAccessory.prototype.setStateDemande = function(estFerme, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;
  var etatDemande = estFerme ? 'close' : 'open';

  accessory.log('Appel de setStat : etatDemande = ' + etatDemande + ', context = ' + context);

  if(etatDemande == 'open') {
    accessory.etatPorteDemande = Characteristic.TargetDoorState.OPEN;
  }
  if(etatDemande == 'close') {
    accessory.etatPorteDemande = Characteristic.TargetDoorState.CLOSED;
  }

  callback();
  return true;
};

GarageCmdAccessory.prototype.getStateActuel = function(callback) {
  var accessory = this;

  callback(null, accessory.etatPorteActuel);
}

GarageCmdAccessory.prototype.getStateDemande = function(callback) {
  var accessory = this;

  callback(null, accessory.etatPorteDemande);
}

GarageCmdAccessory.prototype.monitorState = function() {
  var accessory = this;
  var capteurChange = false;
  var lectureCapteur = '';
  var activerCommande = false;
  var lectureCommande = '';
  var delaiSupplementaire = 0;

  //accessory.log('Etat demande : ' + accessory.etatPorteDemande);
  //accessory.log('Etat actuel  : ' + accessory.etatPorteActuel);

  //accessory.log('Commnande executée : ' + accessory.lireCapteurEtatOuvert);
  try {
    buffer = execSync(accessory.lireCapteurEtatOuvert);
    lectureCapteur = buffer.toString('utf-8').substring(0,2);
  } catch(exception) {
    accessory.log("Erreur lecture du capteur Ouvert :" + exception.sdout);
    LectureCapteur = '';
  }
  switch(lectureCapteur) {
    case 'ON' : 
      //accessory.log('Etat du capteur EtatOuvert de ' + accessory.name + ' est (ON) : ' + lectureCapteur + '(' + this.capteurEtatOuvert + ')');
      accessory.capteurEtatOuvert = true;
      break;
    case 'OF' :
      //accessory.log('Etat du capteur EtatOuvert de ' + accessory.name + ' est (OFF) : ' + lectureCapteur + '(' + this.capteurEtatOuvert + ')');
      accessory.capteurEtatOuvert = false;
      break;
    default :
      //accessory.log('Etat du capteur EtatOuvert de ' + accessory.name + ' est (inconnu) : ' + lectureCapteur + '(' + this.capteurEtatOuvert + ')');
      break;
  }

  //accessory.log('Commnande executée : ' + accessory.lireCapteurEtatFerme);
  lectureCapteur = '';
  try {
    buffer = execSync(accessory.lireCapteurEtatFerme);
    lectureCapteur = buffer.toString('utf-8').substring(0,2);
  } catch(exception) {
    accessory.log("Erreur lecture du capteur Ferme :" + exception.sdout);
    LectureCapteur = '';
  }
  switch(lectureCapteur) {
    case 'ON' : 
      //accessory.log('Etat du capteur EtatFerme de ' + accessory.name + ' est (ON) : ' + lectureCapteur + '(' + this.capteurEtatFerme + ')');
      accessory.capteurEtatFerme = true;
      break;
    case 'OF' :
      //accessory.log('Etat du capteur EtatFerme de ' + accessory.name + ' est (OFF) : ' + lectureCapteur + '(' + this.capteurEtatFerme + ')');
      accessory.capteurEtatFerme = false;
        break;
      default :
      //accessory.log('Etat du capteur EtatFerme de ' + accessory.name + ' est (inconnu) : ' + lectureCapteur + '(' + this.capteurEtatFerme + ')');
        break;
  }

   // accessory.log('Debut test');
  //  accessory.log('Etat du capteur EtatOuvert de ' + accessory.name + ' est : ' + '(' + this.capteurEtatOuvert + ')');
  //  accessory.log('Etat du capteur EtatFerme de ' + accessory.name + ' est : ' + '(' + this.capteurEtatFerme + ')');
  if(!this.capteurEtatOuvert && !this.capteurEtatFerme) {
    if(accessory.etatPorteActuel == Characteristic.CurrentDoorState.OPEN) {
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.CLOSING;
      accessory.etatPorteDemande = Characteristic.TargetDoorState.CLOSED;
      accessory.log('Etat de ' + accessory.name + ' est : Fermeture');
      capteurChange = true;
    }
    if(accessory.etatPorteActuel == Characteristic.CurrentDoorState.CLOSED) {
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.OPENING;
      accessory.etatPorteDemande = Characteristic.CurrentDoorState.OPEN;
      accessory.log('Etat de ' + accessory.name + ' est : ouverture');
      capteurChange = true;
    }
  }

  //  accessory.log('Etat du capteur EtatOuvert de ' + accessory.name + ' est : ' + '(' + this.capteurEtatOuvert + ')');
  //  accessory.log('Etat du capteur EtatFerme de ' + accessory.name + ' est : ' + '(' + this.capteurEtatFerme + ')');
  if(this.capteurEtatFerme) {
    if(accessory.etatPorteActuel != Characteristic.CurrentDoorState.CLOSED) {
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.CLOSED;
      accessory.etatPorteDemande = Characteristic.TargetDoorState.CLOSED;
      accessory.log('Etat de ' + accessory.name + ' est : Ferme');
      capteurChange = true;
    }
  }

  //  accessory.log('Etat du capteur EtatOuvert de ' + accessory.name + ' est : ' + '(' + this.capteurEtatOuvert + ')');
  //  accessory.log('Etat du capteur EtatFerme de ' + accessory.name + ' est : ' + '(' + this.capteurEtatFerme + ')');
  if(this.capteurEtatOuvert) {
    if(accessory.etatPorteActuel != Characteristic.CurrentDoorState.OPEN) {
      accessory.etatPorteActuel = Characteristic.CurrentDoorState.OPEN;
      accessory.etatPorteDemande = Characteristic.CurrentDoorState.OPEN;
      accessory.log('Etat de ' + accessory.name + ' est : ouvert');
      capteurChange = true;
    }
  }
  //  accessory.log('Fin test');

  if(capteurChange) {
    accessory.garageDoorService.getCharacteristic(Characteristic.TargetDoorState).updateValue(accessory.etatPorteDemande);
    accessory.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState).updateValue(accessory.etatPorteActuel);
  }
  
  // la commande est rudimentaire : une impulsion => 
  // Cas 1 : si la porte est fermee => la porte s'ouvre
  // Cas 2 : si la porte est ouverte => la porte se ferme
  // Cas 3 : si la porte est en train de se fermer => la porte s'arrete
  // Cas 4 : si la porte est en train de s'ouvrir => la porte s'arrete
  // Cas 5 : si la porte est arretee => elle s'ouvre si elle avait ete arretee en train de se fermer, ou se ferme si elle avait ete arretee en train de s'ouvrir

  if(accessory.etatPorteDemande == Characteristic.TargetDoorState.OPEN) { // si l'etat demande est ouvert
    switch(accessory.etatPorteActuel) {
      case Characteristic.CurrentDoorState.CLOSED : //si la porte est fermee
        // Cas 1 : on active la commande
        // Il est inutile de changer l'etat actuel.
        accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (ouvrir, ferme) => une implusion');
        activerCommande = true;
      break;
      case Characteristic.CurrentDoorState.CLOSING : //si la porte est en train de se fermer
        // Cas 3 : on active la commande 
        // Il faut changer l'etat actuel de la porte de fermeture a stoppe
        accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (ouvrir, en fermeture) => une impulsion');
        accessory.etatPorteActuel = Characteristic.CurrentDoorState.STOPPED;
        activerCommande = true;
      break;
      case Characteristic.CurrentDoorState.OPENING : //si la porte est en train de s'ouvrir
        // on ne fait rien
        //accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (ouvrir, en ouverture) => rien');
      break;
      case Characteristic.CurrentDoorState.OPEN : //si la porte est ouverte
        // on ne fait rien
        //accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (ouvrir, ouvert) => rien');
      break;
      case Characteristic.CurrentDoorState.STOPPED : //si la porte est stoppee
        // Cas 5 : on active la commande 
        // Il faut changer l'etat actuel de la porte de stoppe a ouverture
        accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (ouvrir, stoppe) => une impulsion');
        accessory.etatPorteActuel = Characteristic.CurrentDoorState.OPENING;;
        activerCommande = true;
      break;
    }
  }
  if(accessory.etatPorteDemande == Characteristic.TargetDoorState.CLOSED) { // si la demande est ferme
    switch(accessory.etatPorteActuel) {
      case Characteristic.CurrentDoorState.OPEN : //si la porte est ouverte
        // Cas 2 : on active la commande
        // Il est inutile de changer l'etat actuel.
        accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (fermer, ouvert) => une implusion');
        activerCommande = true;
      break;
      case Characteristic.CurrentDoorState.OPENING : //si la porte est en train de se fermer
        // Cas 4 : on active la commande 
        // Il faut changer l'etat actuel de la porte de ouverture a stoppe
        accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (fermer, en ouverture) => une impulsion');
        accessory.etatPorteActuel == Characteristic.CurrentDoorState.CLOSING;
        activerCommande = true;
      break;
      case Characteristic.CurrentDoorState.CLOSING : //si la porte est en train de se fermer
        // on ne fait rien
        //accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (fermer, en fermeture) => rien');
      break;
      case Characteristic.CurrentDoorState.CLOSED : //si la porte est fermee
        // on ne fait rien
        //accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (fermer, fermer) => rien');
      break;
      case Characteristic.CurrentDoorState.STOPPED : //si la porte est stoppee
        // Cas 5 : on active la commande 
        // Il faut changer l'etat actuel de la porte de stoppe a fermeture
        accessory.log('Etat demande et actuel de ' + accessory.name + ' sont : (fermer, stoppe) => une impulsion');
        accessory.etatPorteActuel == Characteristic.CurrentDoorState.CLOSING;;
        activerCommande = true;
      break;
    }
  }

  if(activerCommande) {
    try {
      buffer = execSync(accessory.envoyerCommande);
      lectureCommande = buffer.toString('utf-8').substring(0,2);
    } catch(exception) {
	    accessory.log("Erreur d\'exécution de la commande : " + exception.sdout);
      LectureCommande = '';
    }
    switch(lectureCommande) {
      case 'OK' : 
        accessory.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState).updateValue(accessory.etatPorteActuel);
        delaiSupplementaire = 1;
        accessory.log('Commande de l\'envoi d\'impulsion pour ' + accessory.name + ' terminee avec le statut  (OK)');
        break;
      case 'KO' :
        accessory.log('Commande de l\'envoi d\'impulsion pour ' + accessory.name + ' terminee avec le statut  (KO)');
      break;
      default :
        accessory.log('Commande de l\'envoi d\'impulsion pour ' + accessory.name + ' terminee avec le statut (inconnu) : ' + lectureCommande);
       break;
    }
  }

  // Clear any existing timer
  if (accessory.stateTimer) {
    clearTimeout(accessory.stateTimer);
    accessory.stateTimer = null;
  }
  this.stateTimer = setTimeout(this.monitorState.bind(this),(this.intervalLecture + delaiSupplementaire) * 1000);
};

GarageCmdAccessory.prototype.getServices = function() {
  this.log('Debut Getservices');
  this.informationService = new Service.AccessoryInformation();
  this.garageDoorService = new Service.GarageDoorOpener(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Capitaine Kirk Factory')
  .setCharacteristic(Characteristic.Model, 'Garage Commande')
  .setCharacteristic(Characteristic.SerialNumber, '1.0');

  this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
  .on('set', this.setStateDemande.bind(this))
  .on('get', this.getStateDemande.bind(this))
  .updateValue(this.etatPorteDemande);

  this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
  .on('get', this.getStateActuel.bind(this))
  .updateValue(this.etatPorteActuel);

  this.stateTimer = setTimeout(this.monitorState.bind(this),this.intervalLecture * 1000);

  return [this.informationService, this.garageDoorService];
};
