#!/usr/bin/perl -w
#
# Auteur : Christian DEGUEST
#
# Date : 02/12/2018
#
# But : envoyer des commandes au module KP-TCP-I2O2 dans le cadre d'une
#  integration avec perl
#
# Parametres:
#
# SetSR-201.pl <nom du relais> ON
#   active le relais correspondant
#   - si tout s'est bien passe, imprime ON
#   - si un pb est rencontre, imprime KO 
#
# SetSR-201.pl <nom du relais> OFF
#   relache le relais correspondant
#   - si tout s'est bien passe, imprime OFF
#   - si un pb est rencontre, imprime KO 
#
# SetSR-201.pl <nom du relais> 
#   donne l'etat du relais correspondant
#   - si tout s'est bien passe, imprime ON ou OFF
#   - si un pb est rencontre, imprime KO 
#
# SetSR-201.pl <nom du relais> Status
#   indique si le relais est joignable
#   - si joignable, imprime OK
#   - si pas joignable, imprime KO
# 
# Protocole de commandes 
#
# Port de connexion : 12345
#
# Activation du relais 1
#   Commande :
#      AT+STACH1=1
#      AT+STACH1=1,n (n etant la duree en s de 0 a 99999)
#         au terme du delai le reais change d'etat
#   Retour:
#       +STACH1:<etat 0 ou 1>,<Duree de 0 a 100000 - 100000 etant le temp infini>
# 
# Relachement du relais 1
#   Commande :
#      AT+STACH1=0
#      AT+STACH1=0,n (n etant la duree en s de 0 a 99999)
#         au terme du delai le reais change d'etat
#   Retour:
#       +STACH1:<etat 0 ou 1>,<Duree de 0 a 100000 - 100000 etant le temp infini>
# 
# Lecture de l'etat du relais 1
#   Commande :
#      AT+STACH1=?
#   Retour:
#       +STACH1:<etat 0 ou 1>,<Duree de 0 a 100000 - 100000 etant le temp infini>
#
# Lecture du contact 1
#   Commande :
#   AT+OCCH1=?
#
#   Retour:
#       +OCCH1:<etat 0 ou 1>
#
# Pour le fun, vous pouvez utiliser l'utilitaire nc pour dialoguer avec le
# module.
#  $ NC 192.168.0.14 12345
#
# AT (puis <Return>)
#
# renvoie:
# OK
#
use IO::Socket::INET;
use Sys::Syslog;

openlog("TCP-KP-I2O2",'ndelay',LOG_USER);

# auto-flush on socket
$| = 1;

# creating a listening socket
my $EmissionSocket = new IO::Socket::INET (
    PeerHost => '192.168.0.14',
    PeerPort => '12345',
    Proto => 'tcp'
);
if(!$EmissionSocket) {
  syslog(LOG_INFO,"Connexion impossible");
  print "KO";
  print "\n";
  exit(0);
}

if($ARGV[0] eq "Ecrire") {
  if($ARGV[1] eq "ContacteurPorte") {
     my $Reponse = "";
     my $Indicateurs;

     $EmissionSocket->send("AT+STACH1=1,2\r\n");
     #read up to 1024 characters from the connected client
     $EmissionSocket->recv($Reponse, 1024,$Indicateurs);

     if($Reponse eq "OK\r\n") {
       syslog(LOG_INFO,"Commande envoyée (".$Reponse.")");
       print "OK";
     } else {
       syslog(LOG_INFO,"Erreur commande (".$Reponse.")");
       print "KO";
     }  
  }
}

if($ARGV[0] eq "Lire") {
  if($ARGV[1] eq "CapteurFerme") {
     my $Reponse = "";
     my $Indicateurs;

     $EmissionSocket->send("AT+OCCH1=?\r\n");
     #read up to 1024 characters from the connected client
     $EmissionSocket->recv($Reponse, 1024,$Indicateurs);

     if($Reponse eq "+OCCH1:1\r\n") {
       syslog(LOG_INFO,"Capteur Ferme = ON (".$Reponse.")");
       print "ON";
     } elsif  ($Reponse eq "+OCCH1:0\r\n") {
       syslog(LOG_INFO,"Capteur Ferme = OFF (".$Reponse.")");
       print "OFF";
     } else {
       syslog(LOG_INFO,"Capteur Ferme ne répond pas (".$Reponse.")");
       print "";
     }
  }
  if($ARGV[1] eq "CapteurOuvert") {
     my $Reponse = "";
     my $Indicateurs;

     $EmissionSocket->send("AT+OCCH2=?\r\n");
     #read up to 1024 characters from the connected client
     $EmissionSocket->recv($Reponse, 1024,$Indicateurs);

     if($Reponse eq "+OCCH2:1\r\n") {
       syslog(LOG_INFO,"Capteur Ouvert = ON (".$Reponse.")");
       print "ON";
     } elsif  ($Reponse eq "+OCCH2:0\r\n") {
       syslog(LOG_INFO,"Capteur Ouvert = OFF (".$Reponse.")");
       print "OFF";
     } else {
       syslog(LOG_INFO,"Capteur Ouvert ne répond pas (".$Reponse.")");
       print "";
     }
  }
  
}

print "\n";

