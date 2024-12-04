export const exampleCodeCreateCluster = `
    import { createSporeCluster, dob } from '@ckb-ccc/spore'

    function generateClusterDescriptionUnderDobProtocol(): string {
    /**
     * Generation example for DOB0
     */
    const clusterDescription = "My First DOB Cluster";
    const dob0Pattern: dob.PatternElementDob0[] = [
      {
        traitName: "BackgroundColor",
        dobType: "String",
        dnaOffset: 0,
        dnaLength: 1,
        patternType: "options",
        traitArgs: ["red", "blue", "green", "black", "white"],
      },
      {
        traitName: "FontSize",
        dobType: "Number",
        dnaOffset: 1,
        dnaLength: 1,
        patternType: "range",
        traitArgs: [10, 50],
      },
      {
        traitName: "FontFamily",
        dobType: "String",
        dnaOffset: 2,
        dnaLength: 1,
        patternType: "options",
        traitArgs: ["Arial", "Helvetica", "Times New Roman", "Courier New"],
      },
      {
        traitName: "Timestamp",
        dobType: "Number",
        dnaOffset: 3,
        dnaLength: 4,
        patternType: "rawNumber",
      },
      {
        traitName: "ConsoleLog",
        dobType: "String",
        dnaOffset: 7,
        dnaLength: 13,
        patternType: "utf8",
      },
    ];
    const dob0: dob.Dob0 = {
      description: clusterDescription,
      dob: {
        ver: 0,
        decoder: dob.getDecoder(client, "dob0"),
        pattern: dob0Pattern,
      },
    };
    const dob0ClusterDescription = dob.encodeClusterDescriptionForDob0(dob0);
    console.log("dob0 =", dob0ClusterDescription);

    /**
     * Generation example for DOB1
     */
    const dob1Pattern: dob.PatternElementDob1[] = [
      {
        imageName: "IMAGE.0",
        svgFields: "attributes",
        traitName: "",
        patternType: "raw",
        traitArgs: "xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'",
      },
      {
        imageName: "IMAGE.0",
        svgFields: "elements",
        traitName: "Timestamp",
        patternType: "options",
        traitArgs: [
          [
            [0, 1000000],
            "<image width='300' height='200' href='btcfs://b2f4560f17679d3e3fca66209ac425c660d28a252ef72444c3325c6eb0364393i0' />",
          ],
          [
            ["*"],
            "<image width='300' height='200' btcfs://eb3910b3e32a5ed9460bd0d75168c01ba1b8f00cc0faf83e4d8b67b48ea79676i0 />",
          ],
        ],
      },
      {
        imageName: "IMAGE.0",
        svgFields: "elements",
        traitName: "BackgroundColor",
        patternType: "options",
        traitArgs: [
          ["red", "<rect width='20' height='20' x='5' y='5' fill='red' />"],
          ["blud", "<rect width='20' height='20' x='20' y='5' fill='blue' />"],
          ["green", "<rect width='20' height='20' x='5' y='20' fill='green' />"],
          [["*"], "<rect width='20' height='20' x='20' y='20' fill='pink' />"],
        ],
      },
      {
        imageName: "IMAGE.0",
        svgFields: "elements",
        traitName: "ConsoleLog",
        patternType: "options",
        traitArgs: [
          [
            "hello, world!",
            "<image width='100' height='100' href='ipfs://QmeQ6TfqzsjJCMtYmpbyZeMxiSzQGc6Aqg6NyJTeLYrrJr' />",
          ],
          [
            ["*"],
            "<image width='100' height='100' href='ipfs://QmYiiN8EXxAnyddatCbXRYzwU9wwAjh21ms4KEJodxg8Fo' />",
          ],
        ],
      },
    ];
    const dob1: dob.Dob1 = {
      description: clusterDescription,
      dob: {
        ver: 1,
        decoders: [
          {
            decoder: dob.getDecoder(client, "dob0"),
            pattern: dob0Pattern,
          },
          {
            decoder: dob.getDecoder(client, "dob1"),
            pattern: dob1Pattern,
          },
        ],
      },
    };
    const dob1ClusterDescription = dob.encodeClusterDescriptionForDob1(dob1);
    console.log("dob1 =", dob1ClusterDescription);

    return dob1ClusterDescription;
  }
  const creatCluster = async function () {
    if (!signer) return
    let { tx, id } = await createSporeCluster({
      signer,
      data: {
        name: "Hello, Cluster",
        description: generateClusterDescriptionUnderDobProtocol(),
      },
    });
    console.log("clusterId:", id);

    // Complete transaction
    await tx.completeFeeBy(signer);
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    const txHash = await signer.sendTransaction(tx);
    console.log(txHash);
  }  
  `

export const exampleCodeCreateSporeWithCluster = `
const createSporeWithCluster = async function () {
    if (!signer) return

    const hasher = new ccc.HasherCkb(7);
    hasher.update(ccc.bytesFrom("hello, dob", "utf8"));
    let dna = ccc.bytesFrom(hasher.digest());
    dna = ccc.bytesConcat(dna, ccc.bytesFrom("hello, world!", "utf8"));
    expect(dna.length === 20);
    const hexedDna = ccc.bytesTo(dna, "hex"); // no leading "0x"
    const content = \`{"dna":"\${hexedDna}"}\`;

    // Build transaction
    let { tx, id } = await createSpore({
      signer,
      data: {
        contentType: "dob/1",
        content: ccc.bytesFrom(content, "utf8"),
        clusterId:
          "0xcf95169f4843b7647837c7cf7e54e5ce7fbc3c7a5ce3c56898b54525d40d72d6",
      },
      clusterMode: "clusterCell",
    });
    console.log("sporeId:", id);

    // Complete transaction
    await tx.completeFeeBy(signer);
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    const txHash = await signer.sendTransaction(tx);
    console.log(txHash);

  }
`