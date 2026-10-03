import { afterEach, describe, expect, it } from "vitest";
import { decodeFunctionData, type EIP1193Provider } from "viem";

import {
  AugurContractClient,
  buildDemoTokenApproval,
  demoTokenAbi,
  submitPreparedContractTransaction,
} from "@/lib/contracts";
import { executeApprovalClick } from "@/lib/market-actions";

const variables = [
  "NEXT_PUBLIC_MONAD_CHAIN_ID",
  "NEXT_PUBLIC_MONAD_RPC_URL",
  "NEXT_PUBLIC_DEMO_TOKEN_ADDRESS",
  "NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS",
] as const;
const saved = Object.fromEntries(variables.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of variables) {
    const value = saved[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("wallet chain validation", () => {
  it("rejects a transaction before signing when the wallet is on the wrong chain", async () => {
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID = "10143";
    process.env.NEXT_PUBLIC_MONAD_RPC_URL = "https://rpc.example";
    process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
    process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS =
      "0x0000000000000000000000000000000000000002";
    const provider = {
      request: async () => "0x1",
    } as unknown as EIP1193Provider;

    await expect(
      new AugurContractClient().approve(
        { address: "0x0000000000000000000000000000000000000003", provider },
        1n,
      ),
    ).rejects.toThrow("Wrong chain: expected 10143, received 1");
  });

  it("constructs an exact DemoToken approval for the NextOmenMarket spender", () => {
    const token = "0xFF35f01886B83D1782e1170c33D3A11E75b0e90e";
    const market = "0x334761518FAD86f9cddDbE16a42CFb9316fD4D9E";
    const transaction = buildDemoTokenApproval(token, market, 10n ** 18n);
    const decoded = decodeFunctionData({ abi: demoTokenAbi, data: transaction.data });

    expect(transaction.to).toBe(token);
    expect(transaction.data.slice(0, 10)).toBe("0x095ea7b3");
    expect(decoded).toEqual({
      functionName: "approve",
      args: [market, 10n ** 18n],
    });
  });

  it("rejects an address mapping that would send approval calldata to the market", () => {
    const market = "0x334761518FAD86f9cddDbE16a42CFb9316fD4D9E";
    expect(() => buildDemoTokenApproval(market, market, 10n ** 18n)).toThrow(
      "DemoToken and NextOmenMarket addresses must be distinct",
    );
  });

  it("submits the prepared target and calldata without explicit gas or fee fields", async () => {
    const token = "0xFF35f01886B83D1782e1170c33D3A11E75b0e90e";
    const market = "0x334761518FAD86f9cddDbE16a42CFb9316fD4D9E";
    const owner = "0x0000000000000000000000000000000000000003";
    const transaction = buildDemoTokenApproval(token, market, 10n ** 18n);
    let request: unknown;
    const provider = {
      request: async (value: unknown) => {
        request = value;
        return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      },
    } as unknown as EIP1193Provider;

    await submitPreparedContractTransaction({ address: owner, provider }, transaction);

    expect(request).toEqual({
      method: "eth_sendTransaction",
      params: [{ from: owner, to: token, data: transaction.data }],
    });
  });

  it("preflights approval from the connected wallet with estimateGas and eth_call", async () => {
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID = "10143";
    process.env.NEXT_PUBLIC_MONAD_RPC_URL = "https://rpc.example";
    process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS = "0xFF35f01886B83D1782e1170c33D3A11E75b0e90e";
    process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS =
      "0x334761518FAD86f9cddDbE16a42CFb9316fD4D9E";
    const owner = "0x0000000000000000000000000000000000000003";
    const requests: Array<{ method: string; params?: unknown }> = [];
    const provider = {
      request: async (request: { method: string; params?: unknown }) => {
        requests.push(request);
        if (request.method === "eth_chainId") return "0x279f";
        if (request.method === "eth_estimateGas") return "0xcdf7";
        if (request.method === "eth_call") {
          return "0x0000000000000000000000000000000000000000000000000000000000000001";
        }
        throw new Error(`Unexpected method ${request.method}`);
      },
    } as unknown as EIP1193Provider;

    const result = await new AugurContractClient().validateApproval(
      { address: owner, provider },
      10n ** 18n,
    );

    expect(result.gasEstimate).toBe(52_727n);
    expect(requests.map(({ method }) => method)).toEqual(["eth_chainId", "eth_estimateGas", "eth_call"]);
    for (const request of requests.slice(1)) {
      expect(request.params).toEqual([
        { from: owner, to: result.transaction.to, data: result.transaction.data },
        ...(request.method === "eth_call" ? ["latest"] : []),
      ]);
    }
  });

  it("issues exactly one DemoToken send and no market send for one approval click", async () => {
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID = "10143";
    process.env.NEXT_PUBLIC_MONAD_RPC_URL = "https://rpc.example";
    process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS = "0xFF35f01886B83D1782e1170c33D3A11E75b0e90e";
    process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS =
      "0x334761518FAD86f9cddDbE16a42CFb9316fD4D9E";
    const token = process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS;
    const market = process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS;
    const owner = "0x108Bc1519361303Ce5FD55056bf5d45Ab5003A4B";
    const requests: Array<{ method: string; params?: readonly unknown[] }> = [];
    const hash = `0x${"a".repeat(64)}` as `0x${string}`;
    const provider = {
      request: async (request: { method: string; params?: readonly unknown[] }) => {
        requests.push(request);
        if (request.method === "eth_chainId") return "0x279f";
        if (request.method === "eth_estimateGas") return "0xcdf7";
        if (request.method === "eth_call") {
          return "0x0000000000000000000000000000000000000000000000000000000000000001";
        }
        if (request.method === "eth_sendTransaction") return hash;
        throw new Error(`Unexpected method ${request.method}`);
      },
    } as unknown as EIP1193Provider;
    const client = new AugurContractClient(async () => undefined);

    await executeApprovalClick(client, { address: owner, provider }, 10n ** 18n);

    const sends = requests.filter((request) => request.method === "eth_sendTransaction");
    expect(sends).toHaveLength(1);
    const transaction = (sends[0].params?.[0] ?? {}) as { to?: string; data?: `0x${string}` };
    expect(transaction.to).toBe(token);
    expect(transaction.to).not.toBe(market);
    expect(transaction.data?.slice(0, 10)).toBe("0x095ea7b3");
    expect(decodeFunctionData({ abi: demoTokenAbi, data: transaction.data! })).toEqual({
      functionName: "approve",
      args: [market, 10n ** 18n],
    });
  });
});
