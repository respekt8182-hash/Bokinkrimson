-- Extend policy enums with explicit allowed option.
ALTER TYPE "PetsPolicy" ADD VALUE IF NOT EXISTS 'allowed';
ALTER TYPE "SmokingPolicy" ADD VALUE IF NOT EXISTS 'allowed';
