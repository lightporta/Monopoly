declare module '@/online/onlineSdk.js' {
  export class OnlineSDK {
    playerId: string
    roomKey: string | null
    isHost: boolean
    debug: boolean
    connect(url: string): Promise<void>
    on(event: string, cb: (payload: any) => void): () => void
    off(event: string, cb: (payload: any) => void): void
    send(type: string, payload?: any): boolean
    createRoom(roomKey: string, playerName: string): boolean
    joinRoom(roomKey: string, playerName: string): boolean
    leaveRoom(): boolean
    disbandRoom(): boolean
    startGame(): boolean
    restartGame(): boolean
    sendGameAction(action: string, params?: any): boolean
    disconnect(): void
    getPlayerName(): string
    setPlayerName(name: string): void
  }
  export const onlineSDK: OnlineSDK
  export default OnlineSDK
}
