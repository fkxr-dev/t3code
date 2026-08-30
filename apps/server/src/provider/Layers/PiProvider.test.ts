import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  checkPiProviderStatus,
  MINIMUM_PI_VERSION,
  parsePiDiscoveredModels,
  resolvePiDefaultModel,
} from "./PiProvider.ts";

const encoder = new TextEncoder();

function processHandle(input: {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}) {
  const bytes = (value: string | undefined) =>
    value === undefined || value.length === 0
      ? Stream.empty
      : Stream.succeed(encoder.encode(value));
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(900_000_001),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(input.exitCode ?? 0)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: bytes(input.stdout),
    stderr: bytes(input.stderr),
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

function piProbeSpawner(version: string) {
  return ChildProcessSpawner.make((command) => {
    const args = ChildProcess.isStandardCommand(command) ? command.args : [];
    return Effect.succeed(
      args.includes("--version")
        ? processHandle({ stdout: `pi ${version}\n` })
        : processHandle({ stderr: "RPC startup failed", exitCode: 1 }),
    );
  });
}

const settings = {
  enabled: true,
  binaryPath: "pi",
  launchArgs: "",
  customModels: [],
} as const;

describe("PiProvider", () => {
  it("keeps the Pi provider visible when friendly model names collide", () => {
    const models = parsePiDiscoveredModels(
      {
        models: [
          { provider: "anthropic", id: "claude-fable-5", name: "Claude Fable 5" },
          { provider: "claude-bridge", id: "claude-fable-5", name: "Claude Fable 5" },
        ],
      },
      undefined,
    );

    assert.deepEqual(
      models.map(({ slug, name, subProvider }) => ({ slug, name, subProvider })),
      [
        {
          slug: "anthropic/claude-fable-5",
          name: "Claude Fable 5",
          subProvider: "anthropic",
        },
        {
          slug: "claude-bridge/claude-fable-5",
          name: "Claude Fable 5",
          subProvider: "claude-bridge",
        },
      ],
    );
  });

  // `fkxr-dev/pi` fork compatibility.
  it("honors Pi's reported model scope when scopedModels is present", () => {
    const models = parsePiDiscoveredModels(
      {
        models: [
          { provider: "codex", id: "gpt-5.6-sol" },
          { provider: "anthropic", id: "claude-opus-4-7" },
          { provider: "anthropic", id: "claude-opus-4-7" },
        ],
        scopedModels: [
          { model: { provider: "anthropic", id: "claude-opus-4-7" } },
          { model: { provider: "codex", id: "gpt-5.6-sol" }, thinkingLevel: "high" },
          { model: { provider: "codex" } },
        ],
      },
      undefined,
    );

    assert.deepEqual(
      models.map((model) => model.slug),
      ["codex/gpt-5.6-sol", "anthropic/claude-opus-4-7"],
    );
  });

  it("keeps the full catalogue when Pi reports no scope", () => {
    const catalogue = [
      { provider: "codex", id: "gpt-5.6-sol" },
      { provider: "anthropic", id: "claude-opus-4-7" },
    ];
    const allSlugs = ["codex/gpt-5.6-sol", "anthropic/claude-opus-4-7"];

    for (const scopedModels of [undefined, [], "bogus", [{ model: { provider: "x" } }]]) {
      const models = parsePiDiscoveredModels({ models: catalogue, scopedModels }, undefined);
      assert.deepEqual(
        models.map((model) => model.slug),
        allSlugs,
      );
    }
  });

  it("resolves the Pi default alias to the model Pi reports in get_state", () => {
    const model = resolvePiDefaultModel({
      model: {
        provider: "xai",
        id: "grok-4.6",
        name: "Grok 4.6",
        reasoning: true,
      },
      thinkingLevel: "high",
    });

    assert.equal(model?.slug, "default");
    assert.equal(model?.name, "Pi default (Grok 4.6)");
    assert.equal(model?.subProvider, "xai");
    const thinking = model?.capabilities?.optionDescriptors?.find(
      (descriptor) => descriptor.id === "thinking",
    );
    assert.ok(thinking !== undefined && thinking.type === "select");
    assert.deepEqual(
      thinking.options.map((option) => option.id),
      ["off", "minimal", "low", "medium", "high"],
    );
    assert.equal(thinking.options.find((option) => option.isDefault)?.id, "high");
  });

  it("keeps the Pi default alias unqualified without a resolved model", () => {
    assert.equal(resolvePiDefaultModel(undefined), null);
    assert.equal(resolvePiDefaultModel({ thinkingLevel: "high" }), null);
    assert.equal(resolvePiDefaultModel({ model: { provider: "anthropic" } }), null);
  });

  it("exposes no thinking options when Pi's default model has no reasoning", () => {
    const model = resolvePiDefaultModel({
      model: { provider: "ollama", id: "llama3.1:8b" },
      thinkingLevel: "high",
    });

    assert.equal(model?.name, "Pi default (llama3.1:8b)");
    assert.equal(model?.subProvider, "ollama");
    assert.deepEqual(model?.capabilities?.optionDescriptors, []);
  });

  it.effect("requires the first published Pi version with entries and settlement hooks", () =>
    Effect.gen(function* () {
      const snapshot = yield* checkPiProviderStatus(settings).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, piProbeSpawner("0.80.3")),
      );
      assert.equal(snapshot.status, "error");
      assert.equal(snapshot.version, "0.80.3");
      assert.include(snapshot.message ?? "", `Pi ${MINIMUM_PI_VERSION} or newer`);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("keeps compatible Pi selectable when optional discovery fails", () =>
    Effect.gen(function* () {
      const snapshot = yield* checkPiProviderStatus(settings).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, piProbeSpawner("0.84.3")),
      );
      assert.equal(snapshot.status, "ready");
      assert.equal(snapshot.auth.status, "unknown");
      assert.deepEqual(
        snapshot.models.map((model) => model.slug),
        ["default"],
      );
      assert.include(snapshot.message ?? "", "could not refresh its models and commands");
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
