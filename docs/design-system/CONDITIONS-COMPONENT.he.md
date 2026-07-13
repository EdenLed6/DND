# Conditions & Ongoing Effects — Component Specification

## Supported categories

- Official rules conditions
- Ongoing damage
- Injuries
- Exhaustion
- Concentration
- Buffs and debuffs
- Diseases and poisons
- Custom campaign conditions

## Required data

- id
- name
- icon
- category
- severity
- source
- target
- start time
- duration
- remaining rounds
- save ability and DC
- stacks or level
- visibility
- automation triggers
- recovery rule
- notes

## Required states

- Active
- Pending save
- Expiring this turn
- Hidden
- Paused
- Removed
- Immune
- Suppressed

## Player experience

Players see their active conditions in the character header and a detailed condition drawer. Each condition explains its mechanical effects, source, duration and recovery method.

## DM experience

The DM can apply conditions to one or many combatants, control visibility, set duration, define saves, add stacks, link conditions to attacks and configure automatic turn-based effects.

## Combat automation

- Start-of-turn effects
- End-of-turn saves
- Damage-over-time
- Concentration saves
- Movement restrictions
- Advantage/disadvantage
- Speed changes
- Auto-expiration
- Rest-based recovery
- Undo last condition change
