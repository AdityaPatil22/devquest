export enum GamePhase {
  /** Common Room — menu / start screen */
  MENU = 'MENU',
  /** Gate — entering problem statement */
  GATE_INPUT = 'GATE_INPUT',
  /** Waiting for skill to generate first question */
  WAITING_FOR_QUESTION = 'WAITING_FOR_QUESTION',
  /** Decision Room — player sees doors, can walk around */
  EXPLORING_DOORS = 'EXPLORING_DOORS',
  /** Player approached a door — can add context before entering */
  DOOR_CONTEXT = 'DOOR_CONTEXT',
  /** Trophy Room — session complete */
  TROPHY = 'TROPHY',
  /** Player has selected an option and is walking to its room */
  TRAVERSING_OPTION = 'TRAVERSING_OPTION',
}
