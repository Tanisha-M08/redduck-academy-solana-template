/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/raffle.json`.
 */
export type Raffle = {
  "address": "3JPbgoXU4LVsC4Lp2WzxQ7HufHTcFoNShfhiLLABKEFQ",
  "metadata": {
    "name": "raffle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Weighted raffle with MagicBlock VRF (Anchor)"
  },
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "winner",
          "writable": true,
          "signer": true
        },
        {
          "name": "raffle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  102,
                  102,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "randomness",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  110,
                  100,
                  111,
                  109,
                  110,
                  101,
                  115,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "entry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "entryIndex"
              }
            ]
          }
        },
        {
          "name": "winnerAta",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          },
          "relations": [
            "raffle"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "raffle"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "entryIndex",
          "type": "u64"
        }
      ]
    },
    {
      "name": "consumeRandomness",
      "discriminator": [
        190,
        217,
        49,
        162,
        99,
        26,
        73,
        234
      ],
      "accounts": [
        {
          "name": "oracle",
          "signer": true
        },
        {
          "name": "randomness",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  110,
                  100,
                  111,
                  109,
                  110,
                  101,
                  115,
                  115
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "raffle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  102,
                  102,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "entry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "raffle.total_entries",
                "account": "raffle"
              }
            ]
          }
        },
        {
          "name": "playerAta",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          },
          "relations": [
            "raffle"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "raffle"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "raffle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  102,
                  102,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "randomness",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  110,
                  100,
                  111,
                  109,
                  110,
                  101,
                  115,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "drawTime",
          "type": "i64"
        },
        {
          "name": "oracle",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "requestRandomness",
      "discriminator": [
        213,
        5,
        173,
        166,
        37,
        236,
        31,
        18
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "raffle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  102,
                  102,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "randomness",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  110,
                  100,
                  111,
                  109,
                  110,
                  101,
                  115,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "oracleQueue",
          "writable": true,
          "address": "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "entry",
      "discriminator": [
        63,
        18,
        152,
        113,
        215,
        246,
        221,
        250
      ]
    },
    {
      "name": "raffle",
      "discriminator": [
        143,
        133,
        63,
        173,
        138,
        10,
        142,
        200
      ]
    },
    {
      "name": "randomness",
      "discriminator": [
        188,
        96,
        216,
        248,
        93,
        94,
        49,
        112
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "untrustedOracle",
      "msg": "the random value did not come from the trusted oracle"
    },
    {
      "code": 6001,
      "name": "raffleClosed",
      "msg": "Raffle is closed"
    },
    {
      "code": 6002,
      "name": "drawNotReady",
      "msg": "Draw is not ready yet"
    },
    {
      "code": 6003,
      "name": "noEntries",
      "msg": "No entries in raffle"
    },
    {
      "code": 6004,
      "name": "alreadyRequested",
      "msg": "Randomness already requested"
    },
    {
      "code": 6005,
      "name": "randomnessNotRequested",
      "msg": "Randomness not yet requested"
    },
    {
      "code": 6006,
      "name": "randomnessNotFulfilled",
      "msg": "Randomness not yet fulfilled"
    },
    {
      "code": 6007,
      "name": "alreadyClaimed",
      "msg": "Prize already claimed"
    },
    {
      "code": 6008,
      "name": "notWinner",
      "msg": "Claimant is not the winner"
    },
    {
      "code": 6009,
      "name": "zeroAmount",
      "msg": "Deposit amount must be greater than zero"
    },
    {
      "code": 6010,
      "name": "mathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "entry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u64"
          },
          {
            "name": "startTicket",
            "type": "u64"
          },
          {
            "name": "endTicket",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "raffle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "drawTime",
            "type": "i64"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "totalEntries",
            "type": "u64"
          },
          {
            "name": "randomnessRequested",
            "type": "bool"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "randomness",
      "docs": [
        "VRF result account. `oracle` is the only identity allowed to deliver `value`;",
        "record it when you create this account, then the callback can be trusted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oracle",
            "type": "pubkey"
          },
          {
            "name": "value",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fulfilled",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "entrySeed",
      "type": "bytes",
      "value": "[101, 110, 116, 114, 121]"
    },
    {
      "name": "raffleSeed",
      "type": "bytes",
      "value": "[114, 97, 102, 102, 108, 101]"
    },
    {
      "name": "randomnessSeed",
      "type": "bytes",
      "value": "[114, 97, 110, 100, 111, 109, 110, 101, 115, 115]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
