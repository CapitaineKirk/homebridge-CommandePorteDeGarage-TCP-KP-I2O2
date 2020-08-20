# homebridge-CommandePorteDeGarage-TCP-KP-I2O2

<img src="https://github.com/CapitaineKirk/homebridge-CommandePorteDeGarage-TCP-KP-I2O2/blob/master/photos/TCP-KP-I2O2.jpg" width=150 align="right" />  

## But

Envoyer des commandes au module TCP-KP-I2O2 dans le cadre d'une integration dans homebridge d'un dispositif permettant de contrôler une porte du garage.
Ce module est équipé d'une connexion ethernet, de deux entrées et de deux sorties (relais).  

## Remerciements
Merci à l'équipe homebrdige (https://homebridge.io) pour la qualité de son travail. 

## Installation

1. Installez [homebridge](https://github.com/nfarina/homebridge#installation-details)  
2. Installez ce plugin: `npm install -g homebridge-CommandePorteDeGarage-TCP-KP-I2O2`  
3. Mettez à jour le fichier `config.json`  
4. Configurez le module TCP-KP-I2O2  

## Configuration

```json
"accessories": [
     {
       "accessory": "CommandePorteDeGarage-TCP-KP-I2O2",
       "name": "Porte de garage",
       "adresseIp": "192.168.0.14",
       "actionneurPorte": 1,
       "capteurOuvert": 2,
       "capteurFerme": 1,
       "delaiDeReaction" : 2,
       "delaiDeMouvement" : 20,
       "delaiInterCommandes" : 2,
       "intervalLecture": 1,
       "debug": 0
      }
]
```

| Key | Description | Default |
| --- | --- | --- |
| `accessory` | Doit être `CommandePorteDeGarage-TCP-KP-I2O2` | N/A |
| `name` | Nom qui apparaîtra dans l'application Home | N/A |
| `adresseIp` | Adresse Ip du module | N/A |
| `actionneurPorte` | Numéro de la sortie connectée à la commande d'ouverture/fermeture de la porte | N/A |
| `capteurOuvert` | Numéro de l'entrée connectée au capteur détectant l'état ouvert | N/A |
| `capteurFerme` | Numéro de l'entrée connectée au capteur détectant l'état fermé | N/A |
| `delaiDeReaction` | Délai maximum attendu en seconde entre une commande de mouvement et le début du mouvement de la porte (permet de gérer les obstructions) | 2 |
| `delaiDeMouvement` | Délai maximum attendu en seconde entre une commande de mouvement et la fin du mouvement de la porte (permet de gérer les obstructions) | 20 |
| `intervalLecture` | Interval de lecture de l'état du module en seconde| 1 |
| `debug` | Active le mode verbeux | 0 |

## Protocole de commandes du TCP-KP-I2O2
Ce n'est pas utile pour l'utilisation du plugin, mais permet de comprendre le fonctionnement de celui-ci.  
  
Port de connexion TCP (par défaut) : 12345  
  
Interrogation de l'entrée 1 : "AT+OCCH1=?\r\n"  
Réponse si l'entrée 1 est active : "+OCCH1:1\r\n"  
Réponse si l'entrée 1 est inactive : "+OCCH1:0\r\n"  
  
Interrogation de l'entrée 2 : "AT+OCCH2=?\r\n"  
Réponse si l'entrée 2 est active : "+OCCH2:1\r\n"  
Réponse si l'entrée 2 est inactive : "+OCCH2:0\r\n"  
  
Actionne la sortie 1 pendant 1s : "AT+STACH1=1,1\r\n"  
Réponse après exécution : "OK\r\n"  
  
Actionne la sortie 2 pendant 1s : "AT+STACH2=1,1\r\n"  
Réponse après exécution : "OK\r\n"  

## Installation
Le but est de mettre en place des capteurs sur le mécanisme d'ouverture/fermeture de la porte de garage de manière non intrusive.  
  
Pour cela, il faut installer des capteurs de feuillures sur le rail du moteur et placer un aimant sur le moteur.  
<img src="https://github.com/CapitaineKirk/homebridge-CommandePorteDeGarage-TCP-KP-I2O2/blob/master/photos/CapteurFerme.jpg" width=150 align="right" />
<img src="https://github.com/CapitaineKirk/homebridge-CommandePorteDeGarage-TCP-KP-I2O2/blob/master/photos/CapteurOuvert.jpg" width=150 align="right" />

La sortie du module, choisie pour commander la porte, est connectée en parallèle du bouton poussoir permettant l'ouverture ou la fermeture de celle-ci.  
