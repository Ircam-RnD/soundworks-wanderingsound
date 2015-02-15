'use strict';

var clientSide = require('soundworks/client');
var audioContext = require('audio-context');
var SimpleSynth = require('./SimpleSynth');
var ioClient = clientSide.ioClient;
var inputModule = clientSide.inputModule;

function beep() {
  var time = audioContext.currentTime;
  var duration = 0.2;
  var attack = 0.001;

  var g = audioContext.createGain();
  g.connect(audioContext.destination);
  g.gain.value = 0;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.5, time + attack);
  g.gain.exponentialRampToValueAtTime(0.0000001, time + duration);
  g.gain.setValueAtTime(0, time);

  var o = audioContext.createOscillator();
  o.connect(g);
  o.frequency.value = 600;
  o.start(time);
  o.stop(time + duration);
}

class PlayerPerformance extends clientSide.PerformanceSoloists {
  constructor(topology, placement, params = {}) {
    super(params);

    this.topology = topology;
    this.placement = placement;
    this.synths = [new SimpleSynth(false), new SimpleSynth(true)];

    // place info display
    var infoDiv = document.createElement('div');
    infoDiv.setAttribute('id', 'info');
    infoDiv.classList.add('info');
    this.infoDiv = infoDiv;
    this.displayDiv.appendChild(this.infoDiv);

    // topology display
    this.topologyDiv = this.topology.displayDiv;
    this.displayDiv.appendChild(this.topologyDiv);

    // setup liteners
    this.__inputListener();
    this.__performanceControlListener();

    var socket = ioClient.socket;

    socket.on('players_init', (playerList) => {
      this.initPlayers(playerList);
    });

    socket.on('player_add', (player) => {
      this.addPlayer(player);
    });

    socket.on('player_remove', (player) => {
      this.removePlayer(player);
    });

    socket.on('soloists_init', (soloistList) => {
      this.initSoloists(soloistList);
    });

    socket.on('soloist_add', (soloist) => {
      this.addSoloist(soloist);
    });

    socket.on('soloist_remove', (soloist) => {
      this.removeSoloist(soloist);
    });
  }

  initPlayers(playerList) {
    for (let i = 0; i < playerList.length; i++)
      this.topology.displayPlayer(playerList[i].index, true);
  }

  addPlayer(player) {
    this.topology.displayPlayer(player.index, true);
  }

  removePlayer(player) {
    this.topology.displayPlayer(player.index, false);

    var soloistId = player.state.soloistId;

    if (soloistId) {
      this.synths[soloistId].update(1, 0);
      this.__changeBackgroundColor(1);
    }
  }

  initSoloists(soloistList) {
    // for (let i = 0; i < soloistList.length; i++)
    //   this.topology.displayPlayer(soloistList[i].index, true, 'soloist');
  }

  addSoloist(soloist) {
    // this.topology.displayPlayer(soloist.index, true, 'soloist');

    var socket = ioClient.socket;

    if (soloist.socketId === socket.io.engine.id) {
      inputModule.enableTouch(this.topologyDiv);

      this.infoDiv.classList.add('hidden');
      this.topologyDiv.classList.remove('hidden');

      beep();
    }
  }

  removeSoloist(soloist) {
    var soloistId = soloist.state.soloistId;

    // this.topology.displayPlayer(soloist.index, false, 'soloist');

    this.synths[soloistId].update(1, 0);
    this.__changeBackgroundColor(1); // TODO: incorrect

    var socket = ioClient.socket;

    if (soloist.socketId === socket.io.engine.id) {
      inputModule.disableTouch(this.topologyDiv);

      this.topologyDiv.classList.add('hidden');
      this.infoDiv.classList.remove('hidden');
    }
  }

  start() {
    if (this.displayDiv) {
      this.infoDiv.innerHTML = "<p class='small'>You are at position</p>" + "<div class='position'><span>" + this.placement.label + "</span></div>";
      this.infoDiv.classList.remove('hidden');
    }

    this.topology.displayPlayer(this.placement.place, true, 'me');
    super.start();
  }

  __changeBackgroundColor(d) {
    var value = Math.floor(Math.max(1 - d, 0) * 255);
    this.displayDiv.style.backgroundColor = 'rgb(' + value + ', ' + value + ', ' + value + ')';
  }

  __inputListener() {
    inputModule.on('touchstart', this.__touchHandler.bind(this));
    inputModule.on('touchmove', this.__touchHandler.bind(this));
    inputModule.on('touchend', this.__touchHandler.bind(this));
  }

  __performanceControlListener() {
    var socket = ioClient.socket;

    socket.on('perf_control', (soloistId, d, s) => {
      this.synths[soloistId].update(d, s);
      this.__changeBackgroundColor(d);
    });
  }

  __touchHandler(touchData) {
    var socket = ioClient.socket;
    var x = (touchData.coordinates[0] - this.topologyDiv.offsetLeft + window.scrollX) / this.topologyDiv.offsetWidth;
    var y = (touchData.coordinates[1] - this.topologyDiv.offsetTop + window.scrollY) / this.topologyDiv.offsetHeight;

    socket.emit(touchData.event, [x, y], touchData.timestamp); // TODO: might be a good idea to send the time in sever clock. (Requires sync module.)
  }
}

module.exports = PlayerPerformance;