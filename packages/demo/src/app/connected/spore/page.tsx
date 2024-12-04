"use client";

import { Button } from "@/src/components/Button";
import { useState } from "react";
import { TextInput } from "@/src/components/Input";
import { ccc } from "@ckb-ccc/connector-react";
import { useRouter } from "next/navigation";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { createSpore, createSporeCluster, dob } from '@ckb-ccc/spore'
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { FieldValues, useForm } from 'react-hook-form';
interface ClusetrType {
  name: string,
  description: string
}


export default function Page() {
  const router = useRouter();
  const { client } = ccc.useCcc();
  const signer = ccc.useSigner()
  const { register, handleSubmit, formState: { errors } } = useForm();
  const onSubmit = async function (data: FieldValues) {
    if (!signer) return
    let { tx, id } = await createSporeCluster({
      signer,
      data: {
        name: "Hello, Cluster",
        description: data.description,
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


  const createSporeWithCluster = async function () {
    if (!signer) return

    const hasher = new ccc.HasherCkb(7);
    hasher.update(ccc.bytesFrom("hello, dob", "utf8"));
    let dna = ccc.bytesFrom(hasher.digest());
    dna = ccc.bytesConcat(dna, ccc.bytesFrom("hello, world!", "utf8"));
    expect(dna.length === 20);
    const hexedDna = ccc.bytesTo(dna, "hex"); // no leading "0x"
    const content = `{"dna":"${hexedDna}"}`;

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
  return (
    <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-xl font-bold">Creat Cluster</h3>
          <form onSubmit={handleSubmit(onSubmit)}>
            <label>Name:</label>
            <input className={`w-full border-b-2 border-gray-300 bg-transparent px-4 py-2 text-gray-700 focus:border-solid focus:outline-none border-dashed`} {...register("name", { required: true })} />
            {errors.name && <span>Name is required</span>}

            <label>Email:</label>
            <textarea
              className={`w-full border-b-2 border-gray-300 bg-transparent px-4 py-2 text-gray-700 focus:border-solid focus:outline-none border-solid`}
              placeholder="Description"
              {...register("description", { required: true })} />
            {errors.email && <span>Description is required</span>}

            <Button type="submit" className="ml-2" value={''} >Creat Cluster</Button>
          </form>
        </div>
        <div>
          <h3 className="text-xl font-bold">Creat Cluster</h3>
          <form onSubmit={handleSubmit(onSubmit)}>
            <label>Name:</label>
            <input className={`w-full border-b-2 border-gray-300 bg-transparent px-4 py-2 text-gray-700 focus:border-solid focus:outline-none border-dashed`} {...register("name", { required: true })} />
            {errors.name && <span>Name is required</span>}

            <label>Email:</label>
            <textarea
              className={`w-full border-b-2 border-gray-300 bg-transparent px-4 py-2 text-gray-700 focus:border-solid focus:outline-none border-solid`}
              placeholder="Description"
              {...register("description", { required: true })} />
            {errors.email && <span>Description is required</span>}

            <Button type="submit" className="ml-2" value={''} >Creat Cluster</Button>
          </form>
        </div>
      </div>
      {/* <DetailShow title=" Code" detail={
        <CopyBlock text={exampleCodeCreateCluster}
        language={'typescript'}
        theme={dracula}
        showLineNumbers={true} />} /> */}
      <Button
        className="ml-2"
        onClick={() => {
          createSporeWithCluster()
        }}
      >
        Creat Spore with Cluster
      </Button>
      {/* <DetailShow title="Code" detail={
        <CopyBlock text={exampleCodeCreateSporeWithCluster}
        language={'typescript'}
        theme={dracula}
        showLineNumbers={true} />} /> */}
      <ButtonsPanel>
        <Button onClick={() => router.push("/")}>Back</Button>

      </ButtonsPanel>
    </div>
  );
}
