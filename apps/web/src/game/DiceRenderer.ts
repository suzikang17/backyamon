import { Application, Container, Graphics } from "pixi.js";
import type { Dice } from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";

const DIE_BG = 0xd4a857;
const DIE_BORDER = 0x8b4513;
const PIP_COLOR = 0x1a1a0e;
const USED_ALPHA = 0.3;

// Standard dice pip positions (relative to die center, normalized -1..1)
const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [
    [-0.35, -0.35],
    [0.35, 0.35],
  ],
  3: [
    [-0.35, -0.35],
    [0, 0],
    [0.35, 0.35],
  ],
  4: [
    [-0.35, -0.35],
    [0.35, -0.35],
    [-0.35, 0.35],
    [0.35, 0.35],
  ],
  5: [
    [-0.35, -0.35],
    [0.35, -0.35],
    [0, 0],
    [-0.35, 0.35],
    [0.35, 0.35],
  ],
  6: [
    [-0.35, -0.35],
    [0.35, -0.35],
    [-0.35, 0],
    [0.35, 0],
    [-0.35, 0.35],
    [0.35, 0.35],
  ],
};

export class DiceRenderer {
  private app: Application;
  private boardRenderer: BoardRenderer;
  private container: Container;
  private dieContainers: Container[] = [];
  private dieSize: number;

  constructor(app: Application, boardRenderer: BoardRenderer) {
    this.app = app;
    this.boardRenderer = boardRenderer;
    this.container = new Container();
    this.container.zIndex = 500;
    app.stage.addChild(this.container);
    this.dieSize = Math.floor(boardRenderer.getPieceRadius() * 2.2);
  }

  /**
   * Show dice with values and animate the roll.
   */
  async showRoll(dice: Dice): Promise<void> {
    this.hide();

    const center = this.boardRenderer.getDiceCenterPosition();
    const gap = this.dieSize * 0.3;

    // Always show exactly 2 dice
    const totalWidth = 2 * this.dieSize + gap;
    const startX = center.x - totalWidth / 2 + this.dieSize / 2;

    for (let i = 0; i < 2; i++) {
      const die = this.createDie(dice.values[i]);
      die.x = startX + i * (this.dieSize + gap);
      die.y = center.y;
      this.container.addChild(die);
      this.dieContainers.push(die);
    }

    // Animate: quick spin + bounce
    await this.animateRoll();
  }

  /**
   * Show opening roll with each die on its own side of the board.
   * Left die = opponent's roll, right die = local player's roll.
   */
  async showOpeningRoll(leftValue: number, rightValue: number): Promise<void> {
    this.hide();

    const leftPos = this.boardRenderer.getLeftDicePosition();
    const rightPos = this.boardRenderer.getRightDicePosition();

    const leftDie = this.createDie(leftValue);
    leftDie.x = leftPos.x;
    leftDie.y = leftPos.y;
    this.container.addChild(leftDie);
    this.dieContainers.push(leftDie);

    const rightDie = this.createDie(rightValue);
    rightDie.x = rightPos.x;
    rightDie.y = rightPos.y;
    this.container.addChild(rightDie);
    this.dieContainers.push(rightDie);

    await this.animateRoll();
  }

  private async animateRoll(): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = performance.now();
      const duration = 450;

      // Store original positions
      const originals = this.dieContainers.map((d) => ({
        x: d.x,
        y: d.y,
        scale: 1,
      }));

      const tickFn = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        this.dieContainers.forEach((die, i) => {
          // Rotation: spin and settle
          die.rotation = (1 - t) * Math.PI * 3 * (i % 2 === 0 ? 1 : -1);

          // Bounce: ease out bounce
          const bounce = Math.sin(t * Math.PI) * 8;
          die.y = originals[i].y - bounce;

          // Scale: slightly overshoot then settle
          const scale = 1 + Math.sin(t * Math.PI) * 0.15;
          die.scale.set(scale);
        });

        if (t >= 1) {
          this.app.ticker.remove(tickFn);
          // Reset to exact positions
          this.dieContainers.forEach((die, i) => {
            die.rotation = 0;
            die.x = originals[i].x;
            die.y = originals[i].y;
            die.scale.set(1);
          });
          resolve();
        }
      };

      this.app.ticker.add(tickFn);
    });
  }

  private createDie(value: number): Container {
    const c = new Container();
    const g = new Graphics();
    const halfSize = this.dieSize / 2;
    const cornerRadius = this.dieSize * 0.15;

    // Shadow
    g.roundRect(
      -halfSize + 2,
      -halfSize + 2,
      this.dieSize,
      this.dieSize,
      cornerRadius
    ).fill({ color: 0x000000, alpha: 0.3 });

    // Die face
    g.roundRect(-halfSize, -halfSize, this.dieSize, this.dieSize, cornerRadius)
      .fill({ color: DIE_BG })
      .roundRect(-halfSize, -halfSize, this.dieSize, this.dieSize, cornerRadius)
      .stroke({ color: DIE_BORDER, width: 2 });

    c.addChild(g);

    // Pips
    const pipRadius = this.dieSize * 0.08;
    const pips = PIP_POSITIONS[value] ?? [];
    const pipG = new Graphics();
    for (const [px, py] of pips) {
      pipG.circle(px * halfSize * 0.8, py * halfSize * 0.8, pipRadius).fill({
        color: PIP_COLOR,
      });
    }
    c.addChild(pipG);

    return c;
  }

  /**
   * Gray out a used die. Index refers to the visual die container (0-based).
   */
  markDieUsed(index: number): void {
    if (index >= 0 && index < this.dieContainers.length) {
      this.dieContainers[index].alpha = USED_ALPHA;
    }
  }

  /**
   * Update which dice appear used based on remaining values.
   * For doubles, each visual die represents 2 uses (4 total across 2 dice).
   */
  updateUsedDice(originalValues: number[], remaining: number[]): void {
    const isDoubles = originalValues.length === 4;
    const remainingCount = remaining.length;

    if (isDoubles) {
      // 2 visual dice, each covers 2 uses
      // 4 remaining = both lit, 3 = both lit, 2 = one dim, 1 = one dim, 0 = both dim
      this.dieContainers[0].alpha = remainingCount > 2 ? 1 : USED_ALPHA;
      this.dieContainers[1].alpha = remainingCount > 0 ? 1 : USED_ALPHA;
    } else {
      // Normal roll: match each die to whether its value is still remaining
      const remainSet = [...remaining];
      for (let i = 0; i < this.dieContainers.length; i++) {
        const val = originalValues[i];
        const idx = remainSet.indexOf(val);
        if (idx !== -1) {
          this.dieContainers[i].alpha = 1;
          remainSet.splice(idx, 1);
        } else {
          this.dieContainers[i].alpha = USED_ALPHA;
        }
      }
    }
  }

  hide(): void {
    this.container.removeChildren();
    this.dieContainers = [];
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.dieContainers = [];
  }
}
