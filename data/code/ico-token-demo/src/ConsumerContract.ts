import { Int64, Experimental, Circuit, MerkleMapWitness, Field, method, Permissions, PrivateKey, PublicKey, Reducer, Signature, SmartContract, state, State, Struct, UInt32, UInt64, CircuitString, Poseidon, Account, AccountUpdate, Bool, VerificationKey } from "snarkyjs"
import { syncAcctInfo } from "./utils.js";
import { XTokenContract } from "./XTokenContract.js";

/**
 * a consumer demo to transfer tokens from token holders
 */
export class ConsumerContract extends SmartContract {
    @state(PublicKey) xTokenContractAddress = State<PublicKey>();
    @state(UInt64) cost = State<UInt64>();

    init() {
        super.init();
        // set account permissions
        const permissionToEdit = Permissions.proof();
        this.account.permissions.set({
            ...Permissions.default(),
            editState: permissionToEdit,
            send: permissionToEdit,

        });
    }

    /**
     * init or reset the contract account by admin of this account
     * @param xTokenContractAddress 
     * @param cost costing custom token amounts
     * @param adminPriKey the private of deployed ConsumerContract
     */
    @method initOrReset(xTokenContractAddress: PublicKey, cost: UInt64, adminPriKey: PrivateKey) {
        this.address.assertEquals(adminPriKey.toPublicKey());

        this.xTokenContractAddress.set(xTokenContractAddress);
        this.cost.set(cost);
    }

    /**
     * act as a kind of manner to consume XTKN tokens
     * @param consumerAddr 
     */
    @method consume(consumerAddr: PublicKey) {
        this.xTokenContractAddress.assertEquals(this.xTokenContractAddress.get());
        this.cost.assertEquals(this.cost.get());

        const xTokenContract = new XTokenContract(this.xTokenContractAddress.get());
        xTokenContract.sendTokens(consumerAddr, this.address, this.cost.get());
    }
}