import SteamID from "steamid";

class SteamProfile {
  #steamid;

  constructor(steamid) {
    this.#steamid = SteamID(steamid);

    
  }
}