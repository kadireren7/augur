import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  chain: vi.fn(),
  read: vi.fn(),
  factory: vi.fn(),
}));
vi.mock("viem", async (original) => ({
  ...(await original<typeof import("viem")>()),
  createPublicClient: mocks.factory,
}));
import { readMarketPosition } from "./market-position";
beforeEach(() => {
  vi.stubEnv("ALCHEMY_MONAD_RPC_URL", "https://alchemy.example.org");
  vi.stubEnv("MONAD_RPC_URL", "https://monad.example.org");
  vi.stubEnv(
    "NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS",
    "0x334761518FAD86f9cddDbE16a42CFb9316fD4D9E",
  );
  mocks.chain.mockResolvedValue(10143);
  mocks.read.mockImplementation(async ({ functionName, args }) =>
    functionName === "claimed"
      ? false
      : functionName === "userTotal"
        ? 10n ** 18n
        : args[2] === 2
          ? 10n ** 18n
          : 0n,
  );
  mocks.factory.mockReturnValue({
    getChainId: mocks.chain,
    readContract: mocks.read,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("read-only connected-wallet position", () => {
  const wallet = "0x108Bc1519361303Ce5FD55056bf5d45Ab5003A4B";
  it("keeps stake values exact and reads the deployed contract only", async () => {
    expect(await readMarketPosition(1n, wallet)).toMatchObject({
      BUY: "1000000000000000000",
      SELL: "0",
      HOLD: "0",
      claimed: false,
      chainId: 10143,
    });
    expect(mocks.read).toHaveBeenCalledTimes(5);
    expect(
      mocks.read.mock.calls.every(
        ([request]) =>
          request.address === "0x334761518FAD86f9cddDbE16a42CFb9316fD4D9E",
      ),
    ).toBe(true);
  });
  it("stops on wrong chain instead of returning a fixture position", async () => {
    mocks.chain.mockResolvedValue(1);
    await expect(readMarketPosition(1n, wallet)).rejects.toThrow(
      "chain mismatch",
    );
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.factory).toHaveBeenCalledTimes(1);
  });
  it("fails explicitly if all configured RPC providers are unavailable", async () => {
    mocks.chain.mockRejectedValue(new Error("Unavailable"));
    await expect(readMarketPosition(1n, wallet)).rejects.toThrow(
      "RPC unavailable",
    );
    expect(mocks.factory).toHaveBeenCalledTimes(2);
  });
});
