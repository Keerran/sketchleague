import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {useHistory} from "react-router-dom";
import "./util"
import {capitalise} from "./util";

function CreateRoom() {
    const {register, handleSubmit, setValue} = useForm({
        defaultValues: {
            time: 180
        }
    })
    const [categories, setCategories] = useState([] as string[])
    const history = useHistory()

    const onSubmit = async (data: any) => {
        //data.preventDefault()
        const {success} = await window.fetchBackend("/create-room", {
            method: "post",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        history.push(success ? `/room/${data.name}` : "/")
    }
    useEffect(() => {
        window.fetchBackend("/categories").then(json => {
            setCategories(json)
            for (const category of json as string[]) {
                // @ts-ignore
                setValue(category, true)
            }
        })
    }, [setValue])

    return (
        <div id="App">
            <form onSubmit={handleSubmit(onSubmit)}>
                <input key="name" ref={register} type="text" name="name"/>
                <br/>
                {categories.map(category =>
                    <label key={category} htmlFor={category}>
                        {capitalise(category)}:
                        <input ref={register} type="checkbox" name={category}/><br/>
                    </label>,
                )}
                <input key="time" ref={register} type="number" name="time" min="60" max="300"/>
                <input type="submit"/>
            </form>
        </div>
    )
}

export default CreateRoom